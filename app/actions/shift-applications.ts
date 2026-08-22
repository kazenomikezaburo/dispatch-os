"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/shifts/shift-list-rules";
import type { ApplicationActionResult } from "@/lib/admin/shifts/application-action-types";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const message = "応募状態を更新できませんでした。時間をおいて再度お試しください。";
const failure = (): ApplicationActionResult => ({ ok: false, message });

export async function acceptShiftApplication(
  shiftId: string,
  applicationId: string,
): Promise<ApplicationActionResult> {
  return decideShiftApplication(shiftId, applicationId, "accepted");
}

export async function rejectShiftApplication(
  shiftId: string,
  applicationId: string,
): Promise<ApplicationActionResult> {
  return decideShiftApplication(shiftId, applicationId, "rejected");
}

async function decideShiftApplication(
  shiftId: string,
  applicationId: string,
  decision: "accepted" | "rejected",
): Promise<ApplicationActionResult> {
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
    const [shiftResult, applicationResult] = await Promise.all([
      supabase.from("shift_slots").select("id").eq("id", shiftId).maybeSingle(),
      supabase
        .from("shift_applications")
        .select("id, shift_slot_id, worker_id, status")
        .eq("id", applicationId)
        .maybeSingle(),
    ]);
    if (
      shiftResult.error ||
      applicationResult.error ||
      !shiftResult.data ||
      !applicationResult.data ||
      applicationResult.data.shift_slot_id !== shiftId ||
      applicationResult.data.status !== "applied"
    ) {
      return failure();
    }

    const assignmentResult = await supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("shift_slot_id", shiftId)
      .eq("worker_id", applicationResult.data.worker_id)
      .in("status", [...ACTIVE_ASSIGNMENT_STATUSES]);
    if (assignmentResult.error || (assignmentResult.count ?? 0) > 0) {
      return failure();
    }

    const updateResult = await supabase
      .from("shift_applications")
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.profile.id,
      }, { count: "exact" })
      .eq("id", applicationId)
      .eq("shift_slot_id", shiftId)
      .eq("status", "applied");
    if (updateResult.error || updateResult.count !== 1) return failure();

    revalidatePath("/admin/shifts");
    revalidatePath(`/admin/shifts/${shiftId}`);
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to decide shift application", error);
    return failure();
  }
}
