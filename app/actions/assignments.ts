"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentActionResult } from "@/lib/admin/shifts/assignment-action-types";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const generalMessage = "スタッフを配置できませんでした。最新の配置状況を確認して再度お試しください。";
const cancelGeneralMessage = "配置を解除できませんでした。最新の配置状況を確認して再度お試しください。";
const alreadyStartedMessage = "勤務開始後の配置解除はできません。勤怠管理から対応してください。";
const absentGeneralMessage = "欠勤状態を更新できませんでした。最新の勤務状況を確認して、もう一度お試しください。";
const noShowGeneralMessage = "無断欠勤状態を更新できませんでした。最新の勤務状況を確認して、もう一度お試しください。";
const failure = (message = generalMessage): AssignmentActionResult => ({ ok: false, message });

export async function assignWorkerToShift(
  shiftId: string,
  applicationId: string,
): Promise<AssignmentActionResult> {
  if (!uuidSchema.safeParse(shiftId).success || !uuidSchema.safeParse(applicationId).success) return failure();

  const auth = await getCurrentProfile();
  if (
    auth.status !== "authenticated" ||
    auth.profile.account_type === "worker"
  ) {
    return failure();
  }

  try {
    const supabase = await createClient();
    const shiftResult = await supabase
      .from("shift_slots")
      .select("jobs!inner(project_id)")
      .eq("id", shiftId)
      .maybeSingle();
    if (shiftResult.error || !shiftResult.data) return failure();

    const rpcResult = await supabase.rpc("create_assignment_from_application", {
      p_shift_id: shiftId,
      p_application_id: applicationId,
    });
    if (rpcResult.error) throw rpcResult.error;

    const job = shiftResult.data.jobs as unknown as { project_id: string };
    revalidatePath("/admin");
    revalidatePath("/admin/shifts");
    revalidatePath(`/admin/shifts/${shiftId}`);
    revalidatePath(`/admin/projects/${job.project_id}`);
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to assign worker to shift", error);
    return failure();
  }
}

export async function cancelAssignmentByCompany(
  shiftId: string,
  assignmentId: string,
): Promise<AssignmentActionResult> {
  if (!uuidSchema.safeParse(shiftId).success || !uuidSchema.safeParse(assignmentId).success) {
    return failure(cancelGeneralMessage);
  }

  const auth = await getCurrentProfile();
  if (
    auth.status !== "authenticated" ||
    auth.profile.account_type === "worker"
  ) {
    return failure(cancelGeneralMessage);
  }

  try {
    const supabase = await createClient();
    const shiftResult = await supabase
      .from("shift_slots")
      .select("jobs!inner(project_id)")
      .eq("id", shiftId)
      .maybeSingle();
    if (shiftResult.error || !shiftResult.data) {
      return failure(cancelGeneralMessage);
    }

    const rpcResult = await supabase.rpc("cancel_assignment_by_company", {
      p_shift_id: shiftId,
      p_assignment_id: assignmentId,
    });
    if (rpcResult.error?.message === "assignment_already_started") {
      return failure(alreadyStartedMessage);
    }
    if (rpcResult.error) throw rpcResult.error;

    const job = shiftResult.data.jobs as unknown as { project_id: string };
    revalidatePath("/admin");
    revalidatePath("/admin/shifts");
    revalidatePath(`/admin/shifts/${shiftId}`);
    revalidatePath(`/admin/projects/${job.project_id}`);
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to cancel assignment by company", error);
    return failure(cancelGeneralMessage);
  }
}

async function markAssignmentAbsence(
  shiftId: string,
  assignmentId: string,
  kind: "absent" | "no_show",
): Promise<AssignmentActionResult> {
  const message = kind === "absent" ? absentGeneralMessage : noShowGeneralMessage;
  if (!uuidSchema.safeParse(shiftId).success || !uuidSchema.safeParse(assignmentId).success) return failure(message);

  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type === "worker") {
    return failure(message);
  }

  try {
    const supabase = await createClient();
    const shiftResult = await supabase
      .from("shift_slots")
      .select("jobs!inner(project_id)")
      .eq("id", shiftId)
      .maybeSingle();
    if (shiftResult.error || !shiftResult.data) return failure(message);

    const rpcResult = kind === "absent"
      ? await supabase.rpc("mark_assignment_absent", { p_shift_id: shiftId, p_assignment_id: assignmentId })
      : await supabase.rpc("mark_assignment_no_show", { p_shift_id: shiftId, p_assignment_id: assignmentId });
    if (rpcResult.error) throw rpcResult.error;

    const job = shiftResult.data.jobs as unknown as { project_id: string };
    revalidatePath("/admin");
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/shifts");
    revalidatePath(`/admin/shifts/${shiftId}`);
    revalidatePath(`/admin/projects/${job.project_id}`);
    revalidatePath("/worker");
    revalidatePath(`/worker/assignments/${assignmentId}`);
    return { ok: true };
  } catch (error: unknown) {
    console.error(`Failed to mark assignment ${kind}`, error);
    return failure(message);
  }
}

export async function markAssignmentAbsent(shiftId: string, assignmentId: string) {
  return markAssignmentAbsence(shiftId, assignmentId, "absent");
}

export async function markAssignmentNoShow(shiftId: string, assignmentId: string) {
  return markAssignmentAbsence(shiftId, assignmentId, "no_show");
}
