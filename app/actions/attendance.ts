"use server";

import { revalidatePath } from "next/cache";
import { requireWorker } from "@/lib/auth/require-worker";
import { createClient } from "@/lib/supabase/server";
import { workerAttendanceSchema, type WorkerAttendanceInput } from "@/lib/worker/attendance-schema";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { attendanceConfirmationSchema, tokyoLocalToIso, type AttendanceConfirmationInput } from "@/lib/admin/attendance/attendance-confirmation-schema";
import { attendanceRevisionSchema, type AttendanceRevisionInput } from "@/lib/admin/attendance/attendance-revision-schema";

export type AttendanceActionResult = { ok: true } | { ok: false; message: string };

const generalMessage = "勤怠を記録できませんでした。最新の勤務状況を確認して再度お試しください。";

function safeMessage(message: string, kind: "start" | "end") {
  if (message.includes("attendance_start_not_open")) return "現在は勤務開始を打刻できません。";
  if (message.includes("attendance_start_already_recorded")) return "勤務開始はすでに記録されています。";
  if (message.includes("attendance_start_missing")) return "勤務開始が記録されていません。";
  if (message.includes("attendance_end_already_recorded")) return "勤務終了はすでに記録されています。";
  if (message.includes("attendance_assignment_inactive")) return "この勤務は現在打刻できません。";
  return kind === "start" ? generalMessage : generalMessage;
}

async function recordAttendance(input: WorkerAttendanceInput, kind: "start" | "end"): Promise<AttendanceActionResult> {
  const parsed = workerAttendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: generalMessage };
  await requireWorker();
  try {
    const supabase = await createClient();
    const functionName = kind === "start" ? "record_worker_start_work" : "record_worker_end_work";
    const result = await supabase.rpc(functionName, { p_assignment_id: parsed.data.assignmentId });
    if (result.error) return { ok: false, message: safeMessage(result.error.message, kind) };
    revalidatePath("/worker");
    revalidatePath(`/worker/assignments/${parsed.data.assignmentId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/shifts");
    return { ok: true };
  } catch (error: unknown) {
    console.error(`Failed to record worker ${kind} attendance`, error);
    return { ok: false, message: generalMessage };
  }
}

export async function recordWorkerStartWork(input: WorkerAttendanceInput) {
  return await recordAttendance(input, "start");
}

export async function recordWorkerEndWork(input: WorkerAttendanceInput) {
  return await recordAttendance(input, "end");
}

const confirmationGeneralMessage = "勤怠を確定できませんでした。最新の勤務状況を確認して再度お試しください。";

export async function confirmAttendanceRecord(input: AttendanceConfirmationInput): Promise<AttendanceActionResult> {
  const parsed = attendanceConfirmationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "入力内容を確認してください。" };
  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type === "worker") return { ok: false, message: confirmationGeneralMessage };
  const actualStartAt = tokyoLocalToIso(parsed.data.actualStartDate, parsed.data.actualStartTime);
  const actualEndAt = tokyoLocalToIso(parsed.data.actualEndDate, parsed.data.actualEndTime);
  if (!actualStartAt || !actualEndAt) return { ok: false, message: "入力内容を確認してください。" };
  try {
    const supabase = await createClient();
    const assignment = await supabase.from("assignments").select("shift_slot_id, shift_slots!inner(jobs!inner(project_id))").eq("id", parsed.data.assignmentId).maybeSingle();
    if (assignment.error || !assignment.data) return { ok: false, message: confirmationGeneralMessage };
    const result = await supabase.rpc("confirm_attendance_record", { p_assignment_id: parsed.data.assignmentId, p_actual_start_at: actualStartAt, p_actual_end_at: actualEndAt, p_break_minutes: Number(parsed.data.breakMinutes), p_adjustment_reason: parsed.data.adjustmentReason || null });
    if (result.error?.message.includes("attendance_already_confirmed")) return { ok: false, message: "この勤怠は既に確定されています。" };
    if (result.error?.message.includes("attendance_confirmation_invalid_state")) return { ok: false, message: "欠勤または取消として登録された勤務は勤怠確定できません。" };
    if (result.error?.message.includes("attendance_adjustment_reason_required")) return { ok: false, message: "打刻または予定休憩から補正する場合は、修正理由を入力してください。" };
    if (result.error) throw result.error;
    const shift = assignment.data.shift_slots as unknown as { jobs: { project_id: string } };
    revalidatePath("/admin"); revalidatePath("/admin/attendance"); revalidatePath(`/admin/attendance/${parsed.data.assignmentId}`); revalidatePath("/admin/shifts"); revalidatePath(`/admin/shifts/${assignment.data.shift_slot_id}`); revalidatePath(`/admin/projects/${shift.jobs.project_id}`); revalidatePath("/worker"); revalidatePath(`/worker/assignments/${parsed.data.assignmentId}`);
    return { ok: true };
  } catch (error: unknown) { console.error("Failed to confirm attendance record", error); return { ok: false, message: confirmationGeneralMessage }; }
}

const revisionGeneralMessage = "勤怠を訂正できませんでした。最新の勤怠を確認して再度お試しください。";

export async function reviseAttendanceRecord(input: AttendanceRevisionInput): Promise<AttendanceActionResult> {
  const parsed = attendanceRevisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type === "worker") return { ok: false, message: revisionGeneralMessage };
  const actualStartAt = tokyoLocalToIso(parsed.data.actualStartDate, parsed.data.actualStartTime);
  const actualEndAt = tokyoLocalToIso(parsed.data.actualEndDate, parsed.data.actualEndTime);
  if (!actualStartAt || !actualEndAt) return { ok: false, message: "入力内容を確認してください。" };
  try {
    const supabase = await createClient();
    const assignment = await supabase.from("assignments").select("shift_slot_id, shift_slots!inner(jobs!inner(project_id))").eq("id", parsed.data.assignmentId).maybeSingle();
    if (assignment.error || !assignment.data) return { ok: false, message: revisionGeneralMessage };
    const result = await supabase.rpc("revise_attendance_record", { p_assignment_id: parsed.data.assignmentId, p_actual_start_at: actualStartAt, p_actual_end_at: actualEndAt, p_break_minutes: Number(parsed.data.breakMinutes), p_reason: parsed.data.reason });
    if (result.error?.message.includes("attendance_revision_no_change")) return { ok: false, message: "訂正内容が現在の勤怠と同じです。" };
    if (result.error?.message.includes("attendance_revision_invalid_state") || result.error?.message.includes("attendance_record_not_found")) return { ok: false, message: "この勤怠は現在訂正できません。" };
    if (result.error) throw result.error;
    const shift = assignment.data.shift_slots as unknown as { jobs: { project_id: string } };
    revalidatePath("/admin"); revalidatePath("/admin/attendance"); revalidatePath(`/admin/attendance/${parsed.data.assignmentId}`); revalidatePath("/admin/shifts"); revalidatePath(`/admin/shifts/${assignment.data.shift_slot_id}`); revalidatePath(`/admin/projects/${shift.jobs.project_id}`);
    return { ok: true };
  } catch (error: unknown) { console.error("Failed to revise attendance record", error); return { ok: false, message: revisionGeneralMessage }; }
}
