"use server";

import { revalidatePath } from "next/cache";
import { requireWorker } from "@/lib/auth/require-worker";
import { createClient } from "@/lib/supabase/server";
import { preShiftConfirmationSchema, tokyoLocalToIso, type PreShiftConfirmationInput } from "@/lib/worker/pre-shift-confirmation-schema";

export type PreShiftConfirmationActionResult = { ok: true } | { ok: false; message: string };
const generalMessage = "前日確認を送信できませんでした。時間をおいて再度お試しください。";

export async function submitPreShiftConfirmation(input: PreShiftConfirmationInput): Promise<PreShiftConfirmationActionResult> {
  const parsed = preShiftConfirmationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: generalMessage };
  await requireWorker();
  try {
    const supabase = await createClient();
    const rpc = await supabase.rpc("submit_own_pre_shift_confirmation", {
      p_assignment_id: parsed.data.assignmentId,
      p_can_work: parsed.data.canWork,
      p_health_status: parsed.data.healthStatus,
      p_planned_wake_at: tokyoLocalToIso(parsed.data.plannedWakeAt),
      p_planned_departure_at: tokyoLocalToIso(parsed.data.plannedDepartureAt),
    });
    if (rpc.error) throw rpc.error;
    const result = rpc.data as { ok?: boolean; code?: string } | null;
    if (!result?.ok) {
      if (result?.code === "ALREADY_SUBMITTED") return { ok: false, message: "この勤務の前日確認は既に送信済みです。" };
      if (result?.code === "INVALID_PLANNED_TIME") return { ok: false, message: "起床・出発予定は現在より後、集合時刻以前で入力してください。" };
      if (result?.code === "NOT_OPEN" || result?.code === "CLOSED") return { ok: false, message: "現在は前日確認を送信できません。" };
      return { ok: false, message: generalMessage };
    }
    revalidatePath("/worker");
    revalidatePath("/worker/shifts");
    revalidatePath(`/worker/assignments/${parsed.data.assignmentId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to submit pre-shift confirmation", error);
    return { ok: false, message: generalMessage };
  }
}
