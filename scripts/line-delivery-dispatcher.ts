import { z } from "zod";
import { runLineDeliveryBatch } from "../lib/line/dispatcher";
import { closeLineDeliveryDatabase } from "../lib/line/delivery-db";

const enabled = process.env.LINE_DELIVERY_ENABLED === "true";
const pushTimeoutMs = z.coerce.number().int().min(1_000).max(15_000).catch(8_000).parse(process.env.LINE_PUSH_TIMEOUT_MS);
const maxRuntimeMs = z.coerce.number().int().min(10_000).max(120_000).catch(55_000).parse(process.env.LINE_DISPATCHER_MAX_RUNTIME_MS);

function safeLog(event: Record<string, boolean | number | string>) {
  console.log(JSON.stringify({ service: "opscue-line-dispatcher", ...event }));
}

async function main() {
  if (!enabled) {
    safeLog({ event: "line_dispatcher_disabled", outcome: "disabled", claimed: 0, providerCalls: 0 });
    return;
  }

  const watchdog = setTimeout(() => {
    safeLog({ event: "line_dispatcher_watchdog", outcome: "failed", failureType: "runtime_limit" });
    process.exit(1);
  }, maxRuntimeMs);
  watchdog.unref();

  try {
    const modeName = z.enum(["normal", "canary"]).catch("normal").parse(process.env.LINE_DELIVERY_MODE);
    const batchSize = z.coerce.number().int().min(1).max(20).catch(4).parse(process.env.LINE_DELIVERY_BATCH_SIZE);
    const canaryScopeId = process.env.LINE_CANARY_SCOPE_ID;
    const normalDatabaseUrl = process.env.OPSCUE_LINE_DISPATCHER_DATABASE_URL;
    const canaryDatabaseUrl = process.env.OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL;
    if (modeName === "normal" && (canaryScopeId || canaryDatabaseUrl)) {
      throw new Error("normal and canary LINE dispatcher configuration cannot coexist");
    }
    if (modeName === "canary" && (normalDatabaseUrl || !canaryDatabaseUrl || batchSize !== 1)) {
      throw new Error("LINE canary dispatcher requires its dedicated database URL and batch size 1");
    }
    const mode = modeName === "canary"
      ? { kind: "canary" as const, scopeId: z.string().uuid().parse(canaryScopeId) }
      : { kind: "normal" as const };
    const mockMode = process.env.NODE_ENV === "test" && process.env.LINE_PROVIDER_MOCK_MODE === "true";
    const pushEndpoint = mockMode ? z.string().url().parse(process.env.LINE_PROVIDER_MOCK_ENDPOINT) : undefined;
    const result = await runLineDeliveryBatch({ limit: batchSize, timeoutMs: pushTimeoutMs, pushEndpoint, mode });
    safeLog({
      event: "line_dispatcher_complete",
      outcome: result.providerAuthFailures > 0 ? "failed" : "succeeded",
      claimed: result.claimed,
      finalized: result.finalized,
      stale: result.stale,
      delivered: result.delivered,
      retryableFailures: result.retryableFailures,
      terminalFailures: result.terminalFailures,
      providerAuthFailures: result.providerAuthFailures,
      providerAuthFailure: result.providerAuthFailures > 0,
    });
    if (result.providerAuthFailures > 0) process.exitCode = 1;
  } catch {
    safeLog({ event: "line_dispatcher_complete", outcome: "failed", failureType: "controlled_runtime_failure" });
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    await closeLineDeliveryDatabase().catch(() => undefined);
  }
}

void main();
