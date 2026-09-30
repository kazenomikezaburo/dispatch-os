import "server-only";

import postgres from "postgres";
import { z } from "zod";
import type { LinePushResult } from "@/lib/line/push";

const claimSchema = z.object({
  delivery_id: z.string().uuid(),
  notification_id: z.string().uuid(),
  lease_token: z.string().uuid(),
  retry_key: z.string().uuid(),
  attempt_number: z.coerce.number().int().min(1).max(4),
  line_user_id: z.string().regex(/^U[0-9a-f]{32}$/),
  notification_title: z.string().min(1).max(120),
  notification_summary: z.string().min(1).max(240),
});
const finalizeSchema = z.object({
  ok: z.boolean(),
  code: z.string().optional(),
  status: z.string().optional(),
  reason: z.string().optional(),
  attempt_count: z.number().int().optional(),
  next_attempt_at: z.string().nullable().optional(),
});

export type LineDeliveryClaim = z.infer<typeof claimSchema>;
export type LineDeliveryFinalize = z.infer<typeof finalizeSchema>;

export type LineDeliveryStore = {
  claim(limit: number): Promise<LineDeliveryClaim[]>;
  finalize(claim: LineDeliveryClaim, result: LinePushResult): Promise<LineDeliveryFinalize>;
};

export type LineDeliveryMode =
  | { kind: "normal" }
  | { kind: "canary"; scopeId: string };

const clients = new Map<"normal" | "canary", ReturnType<typeof postgres>>();

function databaseClient(mode: LineDeliveryMode) {
  const existing = clients.get(mode.kind);
  if (existing) return existing;
  const url = mode.kind === "canary"
    ? process.env.OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL
    : process.env.OPSCUE_LINE_DISPATCHER_DATABASE_URL;
  if (!url) throw new Error("LINE dispatcher database configuration is unavailable");
  const allowInsecureLocal = process.env.NODE_ENV === "test"
    && process.env.OPSCUE_ALLOW_INSECURE_LOCAL_DISPATCHER_DB === "true";
  const client = postgres(url, {
    max: 2,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 300,
    prepare: false,
    ssl: allowInsecureLocal ? false : "verify-full",
    onnotice: () => undefined,
  });
  clients.set(mode.kind, client);
  return client;
}

export async function closeLineDeliveryDatabase() {
  const current = [...clients.values()];
  clients.clear();
  await Promise.all(current.map((client) => client.end({ timeout: 5 })));
}

export function createLineDeliveryStore(
  mode: LineDeliveryMode = { kind: "normal" },
  sql = databaseClient(mode),
): LineDeliveryStore {
  const parsedMode = mode.kind === "canary"
    ? { kind: "canary" as const, scopeId: z.string().uuid().parse(mode.scopeId) }
    : mode;
  return {
    async claim(limit) {
      const boundedLimit = z.number().int().min(1).max(100).parse(limit);
      if (parsedMode.kind === "canary" && boundedLimit !== 1) {
        throw new Error("LINE canary dispatcher batch size must be exactly 1");
      }
      const rows = await sql.begin(async (transaction) => {
        if (parsedMode.kind === "canary") {
          await transaction`set local role opscue_line_canary_dispatcher`;
          return transaction`select * from private.claim_line_delivery_canary(${parsedMode.scopeId}::uuid)`;
        }
        await transaction`set local role opscue_line_dispatcher`;
        return transaction`select * from private.claim_line_deliveries(${boundedLimit})`;
      });
      return z.array(claimSchema).parse(rows);
    },
    async finalize(claim, result) {
      const rows = await sql.begin(async (transaction) => {
        if (parsedMode.kind === "canary") {
          await transaction`set local role opscue_line_canary_dispatcher`;
        } else {
          await transaction`set local role opscue_line_dispatcher`;
        }
        return transaction`
          select private.finalize_line_delivery(
            ${claim.delivery_id}::uuid,
            ${claim.lease_token}::uuid,
            ${result.resultKind},
            ${result.httpStatus},
            ${result.retryAfterSeconds},
            ${result.retryKeyAccepted},
            ${result.safeErrorCode},
            ${result.providerRequestId}
          ) as result
        `;
      });
      return finalizeSchema.parse(rows[0]?.result);
    },
  };
}
