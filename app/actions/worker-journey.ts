"use server";

import { revalidatePath } from "next/cache";
import { requireWorker } from "@/lib/auth/require-worker";
import { createClient } from "@/lib/supabase/server";
import { workerJourneyActionSchema } from "@/lib/worker/journey/worker-journey-action-schema";

const controlledCodes = [
  "RECORDED",
  "ALREADY_RECORDED",
  "NOT_OPEN",
  "NOT_REQUIRED",
  "SUPERSEDED",
  "CLOSED",
  "NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
] as const;

export type WorkerJourneyActionCode = (typeof controlledCodes)[number] | "UNAVAILABLE" | "UNKNOWN";
export type WorkerJourneyActionResult = {
  ok: boolean;
  code: WorkerJourneyActionCode;
  message: string;
  retryable: boolean;
};

type RpcResult = { ok?: boolean; code?: string } | null;

const messages: Record<WorkerJourneyActionCode, string> = {
  RECORDED: "報告を記録しました。",
  ALREADY_RECORDED: "この報告はすでに記録されています。最新の状態を表示します。",
  NOT_OPEN: "まだ報告できる時間ではありません。最新の予定をご確認ください。",
  NOT_REQUIRED: "この報告は現在必要ありません。",
  SUPERSEDED: "後続の報告が記録されているため、この操作は終了しています。",
  CLOSED: "この勤務では現在報告できません。",
  NOT_FOUND: "対象の勤務が見つからないか、この操作を実行できません。",
  IDEMPOTENCY_CONFLICT: "操作情報が一致しません。画面を再読み込みしてください。",
  UNAVAILABLE: "報告を記録できませんでした。最新の勤務状況をご確認ください。",
  UNKNOWN: "通信結果を確認できませんでした。同じ操作をもう一度お試しください。",
};

function response(code: WorkerJourneyActionCode, ok = false, retryable = false): WorkerJourneyActionResult {
  return { ok, code, message: messages[code], retryable };
}

export async function recordOwnAssignmentJourneyEvent(input: unknown): Promise<WorkerJourneyActionResult> {
  const parsed = workerJourneyActionSchema.safeParse(input);
  if (!parsed.success) return response("UNAVAILABLE");

  await requireWorker();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_own_assignment_journey_event", {
      p_assignment_id: parsed.data.assignmentId,
      p_journey_type: parsed.data.journeyType,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (error) throw error;

    const rpc = data as RpcResult;
    const code = controlledCodes.find((value) => value === rpc?.code) ?? "UNAVAILABLE";
    const ok = code === "RECORDED" || code === "ALREADY_RECORDED";
    if (ok) {
      revalidatePath("/worker");
      revalidatePath("/worker/shifts");
      revalidatePath(`/worker/assignments/${parsed.data.assignmentId}`);
    }
    return response(code, ok);
  } catch (error: unknown) {
    console.error("Worker journey command failed", error);
    return response("UNKNOWN", false, true);
  }
}
