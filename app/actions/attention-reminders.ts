"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const singleSchema = z.object({ assignmentId: uuid, idempotencyKey: uuid });
const bulkSchema = z.object({
  assignmentIds: z.array(uuid).min(1).max(50),
  idempotencyKey: uuid,
});

const outcomes = [
  "projected",
  "not_eligible",
  "no_recipient",
  "inactive_recipient",
  "rate_limited",
  "unavailable",
] as const;
const outcomeSchema = z.enum(outcomes);
const rpcResultSchema = z.object({
  ok: z.literal(true),
  command_id: uuid,
  replayed: z.boolean(),
  status: z.enum(["complete", "no_recipient", "no_action", "partial"]),
  counts: z.object({
    requested: z.number().int().nonnegative(),
    projected: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
  items: z.array(z.object({
    assignment_id: uuid,
    outcome: outcomeSchema,
    notification_id: uuid.nullable(),
  })),
});

export type AttentionReminderOutcome = z.infer<typeof outcomeSchema>;
export type AttentionReminderResult =
  | {
      ok: true;
      replayed: boolean;
      status: "complete" | "no_recipient" | "no_action" | "partial";
      counts: { requested: number; projected: number; skipped: number };
      items: Array<{ assignmentId: string; outcome: AttentionReminderOutcome }>;
    }
  | { ok: false; message: string; retryable: boolean };

function errorMessage(code: unknown) {
  if (code === "IDEMPOTENCY_CONFLICT") return "同じ操作キーで異なる対象が指定されました。画面を更新して再度お試しください。";
  if (code === "FORBIDDEN") return "この操作を実行する権限がありません。";
  if (code === "INVALID_INPUT") return "通知対象を確認してください。";
  return "再通知を実行できませんでした。時間をおいて再度お試しください。";
}

async function send(
  input: { assignmentIds: string[]; idempotencyKey: string; mode: "single" | "bulk" },
): Promise<AttentionReminderResult> {
  await requireAdmin();
  const supabase = await createClient();
  const response = input.mode === "single"
    ? await supabase.rpc("send_pre_confirmation_reminder", {
        p_assignment_id: input.assignmentIds[0],
        p_idempotency_key: input.idempotencyKey,
      })
    : await supabase.rpc("send_pre_confirmation_reminders", {
        p_assignment_ids: input.assignmentIds,
        p_idempotency_key: input.idempotencyKey,
      });

  if (response.error) {
    console.error("Failed to send Attention pre-confirmation reminder", response.error);
    return { ok: false, message: errorMessage(null), retryable: true };
  }
  const value = response.data as Record<string, unknown> | null;
  if (value?.ok !== true) {
    return { ok: false, message: errorMessage(value?.code), retryable: value?.code === "INTERNAL_ERROR" };
  }
  const parsed = rpcResultSchema.safeParse(value);
  if (!parsed.success) {
    console.error("Unexpected Attention reminder result", parsed.error);
    return { ok: false, message: errorMessage(null), retryable: true };
  }

  revalidatePath("/admin/attention");
  revalidatePath("/admin");
  revalidatePath("/worker");
  revalidatePath("/worker/notifications");
  return {
    ok: true,
    replayed: parsed.data.replayed,
    status: parsed.data.status,
    counts: parsed.data.counts,
    items: parsed.data.items.map((item) => ({
      assignmentId: item.assignment_id,
      outcome: item.outcome,
    })),
  };
}

export async function sendAttentionReminder(input: unknown): Promise<AttentionReminderResult> {
  const parsed = singleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "通知対象を確認してください。", retryable: false };
  return send({ assignmentIds: [parsed.data.assignmentId], idempotencyKey: parsed.data.idempotencyKey, mode: "single" });
}

export async function sendAttentionReminders(input: unknown): Promise<AttentionReminderResult> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "通知対象は1〜50件で選択してください。", retryable: false };
  const assignmentIds = [...new Set(parsed.data.assignmentIds)].sort();
  if (assignmentIds.length > 50) return { ok: false, message: "通知対象は50件以内で選択してください。", retryable: false };
  return send({ assignmentIds, idempotencyKey: parsed.data.idempotencyKey, mode: "bulk" });
}
