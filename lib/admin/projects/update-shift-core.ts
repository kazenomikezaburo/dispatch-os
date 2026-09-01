import "server-only";

import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/projects/project-rules";
import { editConflictMessage, editGeneralErrorMessage, type EditActionResult } from "@/lib/admin/edit/edit-action-result";
import type { EditActor } from "@/lib/admin/edit/get-edit-actor";
import { createClient } from "@/lib/supabase/server";
import { shiftFormSchema, tokyoLocalToIso, type ShiftFormValues } from "./shift-form-schema";
import type { ShiftUpdateInput } from "./shift-update-schema";

export type ShiftUpdateField = keyof ShiftFormValues;
export type ShiftUpdateResult = EditActionResult<ShiftUpdateField>;

type CurrentShift = {
  id: string;
  job_id: string;
  starts_at: string;
  ends_at: string;
  required_workers: number;
  break_minutes: number | null;
  application_deadline: string | null;
  status: ShiftFormValues["status"];
  updated_at: string;
  jobs: { project_id: string; projects: { branch_id: string } };
};

const notFoundMessage = "シフトが見つからないか、編集する権限がありません。";

export async function updateShiftCore(input: ShiftUpdateInput, actor: EditActor): Promise<ShiftUpdateResult & { projectId?: string }> {
  try {
    void actor;
    const parsedValues = shiftFormSchema.safeParse(input);
    if (!parsedValues.success) {
      const fieldErrors: Partial<Record<ShiftUpdateField, string>> = {};
      for (const issue of parsedValues.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in fieldErrors)) fieldErrors[field as ShiftUpdateField] = issue.message;
      }
      return { ok: false, type: "validation", message: "入力内容を確認してください。", fieldErrors };
    }

    const supabase = await createClient();
    const currentResult = await supabase.from("shift_slots").select("id, job_id, starts_at, ends_at, required_workers, break_minutes, application_deadline, status, updated_at, jobs!inner(project_id, projects!inner(branch_id))").eq("id", input.id).maybeSingle();
    if (currentResult.error) throw currentResult.error;
    if (!currentResult.data) return { ok: false, type: "not_found", message: notFoundMessage };
    const row = currentResult.data as unknown as CurrentShift;

    const startsAt = tokyoLocalToIso(input.start_date, input.start_time);
    const endsAt = tokyoLocalToIso(input.end_date, input.end_time);
    const deadline = input.deadline_date && input.deadline_time ? tokyoLocalToIso(input.deadline_date, input.deadline_time) : null;
    if (!startsAt || !endsAt) return { ok: false, type: "validation", message: "入力内容を確認してください。" };
    const values = {
      starts_at: startsAt,
      ends_at: endsAt,
      required_workers: Number(input.required_workers),
      break_minutes: input.break_minutes === "" ? null : Number(input.break_minutes),
      application_deadline: deadline,
      status: input.status,
    };
    const unchanged = values.starts_at === row.starts_at && values.ends_at === row.ends_at && values.required_workers === row.required_workers && values.break_minutes === row.break_minutes && values.application_deadline === row.application_deadline && values.status === row.status;
    if (unchanged) return { ok: true, type: "no_change", id: row.id, updatedAt: row.updated_at, projectId: row.jobs.project_id };
    if (row.updated_at !== input.expectedUpdatedAt) return { ok: false, type: "conflict", message: editConflictMessage };

    const [applications, assignments] = await Promise.all([
      supabase.from("shift_applications").select("id").eq("shift_slot_id", row.id).limit(1),
      supabase.from("assignments").select("id").eq("shift_slot_id", row.id).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]),
    ]);
    if (applications.error || assignments.error) throw applications.error ?? assignments.error;
    const activeAssignmentIds = (assignments.data ?? []).map((item) => item.id);
    const hasApplications = (applications.data?.length ?? 0) > 0;
    const hasAssignments = activeAssignmentIds.length > 0;
    let hasAttendance = false;
    if (activeAssignmentIds.length > 0) {
      const [events, records] = await Promise.all([
        supabase.from("attendance_events").select("id").in("assignment_id", activeAssignmentIds).limit(1),
        supabase.from("attendance_records").select("id").in("assignment_id", activeAssignmentIds).limit(1),
      ]);
      if (events.error || records.error) throw events.error ?? records.error;
      hasAttendance = (events.data?.length ?? 0) > 0 || (records.data?.length ?? 0) > 0;
    }

    const fieldErrors: Partial<Record<ShiftUpdateField, string>> = {};
    const plannedTimeChanged = values.starts_at !== row.starts_at || values.ends_at !== row.ends_at;
    if (plannedTimeChanged && (hasApplications || hasAssignments || hasAttendance || Date.now() >= new Date(row.starts_at).getTime())) {
      fieldErrors.start_date = "応募・配置・勤怠がある、または勤務開始済みのため予定時間を変更できません。";
      fieldErrors.end_date = fieldErrors.start_date;
    }
    if (values.required_workers < activeAssignmentIds.length) fieldErrors.required_workers = `配置済み${activeAssignmentIds.length}名以上を指定してください。`;
    if (values.break_minutes !== row.break_minutes && hasAssignments) fieldErrors.break_minutes = "配置済みスタッフがいるため休憩時間を変更できません。";
    if (Object.keys(fieldErrors).length > 0) return { ok: false, type: "validation", message: "現在の応募・配置・勤怠状態では変更できない項目があります。", fieldErrors };

    const updateResult = await supabase.from("shift_slots").update(values).eq("id", row.id).eq("updated_at", input.expectedUpdatedAt).select("id, updated_at");
    if (updateResult.error) throw updateResult.error;
    if (updateResult.data.length === 0) return { ok: false, type: "conflict", message: editConflictMessage };
    if (updateResult.data.length !== 1) throw new Error("Unexpected shift update row count.");
    return { ok: true, type: "updated", id: row.id, updatedAt: updateResult.data[0].updated_at, projectId: row.jobs.project_id };
  } catch (error: unknown) {
    console.error("Failed to update shift", error);
    return { ok: false, type: "error", message: editGeneralErrorMessage };
  }
}
