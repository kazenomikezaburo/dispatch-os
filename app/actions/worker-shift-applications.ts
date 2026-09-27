"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const commandSchema = z.object({
  shiftId: uuidSchema,
  idempotencyKey: z.string().uuid(),
});

type ApplicationState = "applied" | "accepted" | "rejected" | "withdrawn" | null;

export type WorkerApplicationActionResult = {
  ok: boolean;
  outcome: string;
  message: string;
  retryable: boolean;
  applicationState: ApplicationState;
  replayed: boolean;
};

type RpcResult = {
  ok?: boolean;
  outcome?: string;
  applicationState?: ApplicationState;
  replayed?: boolean;
} | null;

const messages: Record<string, string> = {
  applied: "応募を受け付けました。",
  existing_applied: "この勤務には応募済みです。",
  withdrawn: "応募を取り下げました。",
  already_withdrawn: "この応募はすでに取り下げ済みです。",
  not_eligible: "現在の勤務条件では応募できません。最新の条件をご確認ください。",
  deadline_passed: "応募期限を過ぎたため応募できません。",
  capacity_full: "募集枠が埋まったため応募できません。",
  not_recruiting: "この勤務は現在募集していません。",
  already_assigned: "この勤務にはすでにアサインされています。",
  application_accepted: "採用済みの応募は取り下げられません。",
  application_rejected: "見送り済みの応募は変更できません。",
  application_withdrawn: "取り下げ済みの応募には再応募できません。",
  IDEMPOTENCY_CONFLICT: "操作情報が一致しません。画面を再読み込みしてください。",
  unavailable: "対象が見つからないか、この操作を実行できません。",
};

function failure(outcome = "unavailable", retryable = false): WorkerApplicationActionResult {
  return {
    ok: false,
    outcome,
    message: messages[outcome] ?? "応募状態を更新できませんでした。",
    retryable,
    applicationState: null,
    replayed: false,
  };
}

function refresh(shiftId: string) {
  revalidatePath("/worker/recruitment");
  revalidatePath(`/worker/recruitment/${shiftId}`);
  revalidatePath("/admin/shifts");
  revalidatePath(`/admin/shifts/${shiftId}`);
}

async function run(
  rpc: "apply_to_own_shift" | "withdraw_own_shift_application",
  input: unknown,
): Promise<WorkerApplicationActionResult> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return failure();

  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type !== "worker") return failure();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(rpc, {
      p_shift_id: parsed.data.shiftId,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (error) throw error;

    const result = data as RpcResult;
    const outcome = result?.outcome ?? "unavailable";
    const response: WorkerApplicationActionResult = {
      ok: result?.ok === true,
      outcome,
      message: messages[outcome] ?? "応募状態を更新できませんでした。最新の状態をご確認ください。",
      retryable: false,
      applicationState: result?.applicationState ?? null,
      replayed: result?.replayed === true,
    };
    refresh(parsed.data.shiftId);
    return response;
  } catch (error: unknown) {
    console.error("Worker Application command failed", error);
    return {
      ...failure("unknown", true),
      message: "通信結果を確認できませんでした。同じ操作をもう一度お試しください。",
    };
  }
}

export async function applyToOwnShift(input: unknown): Promise<WorkerApplicationActionResult> {
  return run("apply_to_own_shift", input);
}

export async function withdrawOwnShiftApplication(input: unknown): Promise<WorkerApplicationActionResult> {
  return run("withdraw_own_shift_application", input);
}
