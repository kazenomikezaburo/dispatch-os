"use server";

import { revalidatePath } from "next/cache";
import { requireWorker } from "@/lib/auth/require-worker";
import { createClient } from "@/lib/supabase/server";
import { getPreShiftConfirmationState } from "@/lib/domain/pre-shift-confirmation";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/dashboard/dashboard-rules";
import { getCurrentWorkerId } from "@/lib/worker/get-worker-assignment";
import { preShiftConfirmationSchema, type PreShiftConfirmationInput } from "@/lib/worker/pre-shift-confirmation-schema";

export type PreShiftConfirmationActionResult = { ok: true } | { ok: false; message: string };
const generalMessage = "前日確認を送信できませんでした。時間をおいて再度お試しください。";

export async function submitPreShiftConfirmation(input: PreShiftConfirmationInput): Promise<PreShiftConfirmationActionResult> {
  const parsed = preShiftConfirmationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: generalMessage };
  const profile = await requireWorker();
  try {
    const supabase = await createClient();
    const workerId = await getCurrentWorkerId(profile.id);
    if (!workerId) return { ok: false, message: generalMessage };
    const assignmentResult = await supabase.from("assignments").select("id, worker_id, shift_slot_id, shift_slots!inner(starts_at)").eq("id", parsed.data.assignmentId).eq("worker_id", workerId).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]).maybeSingle();
    if (assignmentResult.error || !assignmentResult.data) return { ok: false, message: generalMessage };
    const existing = await supabase.from("pre_shift_confirmations").select("id").eq("assignment_id", parsed.data.assignmentId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { ok: false, message: "この勤務の前日確認は既に送信済みです。" };
    const shift = assignmentResult.data.shift_slots as unknown as { starts_at: string };
    const now = new Date();
    const state = getPreShiftConfirmationState({ startsAt: shift.starts_at, hasConfirmation: false, now });
    if (state !== "pending" || now.getTime() >= new Date(shift.starts_at).getTime()) {
      return { ok: false, message: "現在は前日確認を送信できません。" };
    }
    const insertResult = await supabase.from("pre_shift_confirmations").insert({ assignment_id: parsed.data.assignmentId, can_work: parsed.data.canWork, health_status: parsed.data.healthStatus });
    if (insertResult.error) {
      if (insertResult.error.code === "23505") return { ok: false, message: "この勤務の前日確認は既に送信済みです。" };
      throw insertResult.error;
    }
    revalidatePath("/worker");
    revalidatePath(`/worker/assignments/${parsed.data.assignmentId}`);
    revalidatePath("/admin");
    revalidatePath(`/admin/shifts/${assignmentResult.data.shift_slot_id}`);
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to submit pre-shift confirmation", error);
    return { ok: false, message: generalMessage };
  }
}
