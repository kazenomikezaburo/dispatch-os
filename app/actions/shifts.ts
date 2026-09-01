"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { shiftFormSchema, tokyoLocalToIso, type ShiftFormValues } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftCreateFailure, ShiftCreateResult } from "@/lib/admin/projects/shift-form-types";
import {
  bulkShiftFormSchema,
  buildBulkShiftSchedule,
  type BulkShiftFormValues,
} from "@/lib/admin/projects/bulk-shift-form-schema";
import type { BulkShiftCreateResult } from "@/lib/admin/projects/bulk-shift-form-types";
import { uuidSchema } from "@/lib/utils/uuid-schema";
import { getEditActor } from "@/lib/admin/edit/get-edit-actor";
import { shiftUpdateSchema } from "@/lib/admin/projects/shift-update-schema";
import { updateShiftCore, type ShiftUpdateResult } from "@/lib/admin/projects/update-shift-core";

const failure = (): ShiftCreateResult => ({ ok: false, message: "シフトを追加できませんでした。入力内容を確認して再度お試しください。" });
async function createShiftCore(projectId: string, jobId: string, input: unknown): Promise<ShiftCreateResult> {
  if (!uuidSchema.safeParse(projectId).success || !uuidSchema.safeParse(jobId).success) return failure();
  const parsed = shiftFormSchema.safeParse(input);
  if (!parsed.success) { const fieldErrors: NonNullable<ShiftCreateFailure["fieldErrors"]> = {}; for (const issue of parsed.error.issues) { const field = issue.path[0]; if (typeof field === "string" && !(field in fieldErrors)) fieldErrors[field as keyof ShiftFormValues] = issue.message; } return { ok: false, fieldErrors }; }
  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type === "worker") return failure();
  try {
    const supabase = await createClient();
    const [project, job] = await Promise.all([
      supabase.from("projects").select("id").eq("id", projectId).maybeSingle(),
      supabase.from("jobs").select("id, project_id").eq("id", jobId).eq("project_id", projectId).maybeSingle(),
    ]);
    if (project.error || job.error || !project.data || !job.data || job.data.project_id !== project.data.id) return failure();
    const startsAt = tokyoLocalToIso(parsed.data.start_date, parsed.data.start_time);
    const endsAt = tokyoLocalToIso(parsed.data.end_date, parsed.data.end_time);
    const deadline = parsed.data.deadline_date && parsed.data.deadline_time ? tokyoLocalToIso(parsed.data.deadline_date, parsed.data.deadline_time) : null;
    if (!startsAt || !endsAt || endsAt <= startsAt || (deadline && deadline > startsAt)) return failure();
    const shiftId = crypto.randomUUID();
    const result = await supabase.from("shift_slots").insert({ id: shiftId, job_id: job.data.id, starts_at: startsAt, ends_at: endsAt, required_workers: Number(parsed.data.required_workers), break_minutes: parsed.data.break_minutes === "" ? null : Number(parsed.data.break_minutes), application_deadline: deadline, status: parsed.data.status });
    if (result.error) throw result.error;
    revalidatePath("/admin"); revalidatePath("/admin/projects"); revalidatePath(`/admin/projects/${projectId}`);
    return { ok: true, shiftId };
  } catch (error: unknown) {
    console.error("Failed to create shift", error);
    return failure();
  }
}

export async function createShift(projectId: string, jobId: string, input: unknown): Promise<ShiftCreateResult> {
  const result = await createShiftCore(projectId, jobId, input);
  if (result.ok) redirect(`/admin/projects/${projectId}`);
  return result;
}

export async function createShiftInline(projectId: string, jobId: string, input: unknown): Promise<ShiftCreateResult> {
  return createShiftCore(projectId, jobId, input);
}

export async function updateShift(input: unknown): Promise<ShiftUpdateResult> {
  const parsed = shiftUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, type: "validation", message: "入力内容を確認してください。" };
  const actor = await getEditActor();
  if (!actor.ok) return { ok: false, type: "forbidden", message: "このシフトを編集する権限がありません。" };
  const result = await updateShiftCore(parsed.data, actor.actor);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    if (result.projectId) revalidatePath(`/admin/projects/${result.projectId}`);
    revalidatePath("/admin/shifts");
    revalidatePath(`/admin/shifts/${result.id}`);
    revalidatePath("/admin/attendance");
  }
  return result;
}

const bulkFailure = (message = "シフトをまとめて追加できませんでした。入力内容を確認して再度お試しください。"): BulkShiftCreateResult => ({
  ok: false,
  message,
});

export async function createBulkShifts(
  projectId: string,
  jobId: string,
  input: unknown,
): Promise<BulkShiftCreateResult> {
  if (!uuidSchema.safeParse(projectId).success || !uuidSchema.safeParse(jobId).success) return bulkFailure();

  const parsed = bulkShiftFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: BulkShiftCreateResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field as keyof BulkShiftFormValues] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const auth = await getCurrentProfile();
  if (
    auth.status !== "authenticated" ||
    auth.profile.account_type === "worker"
  ) {
    return bulkFailure();
  }

  try {
    const supabase = await createClient();
    const [project, job] = await Promise.all([
      supabase.from("projects").select("id").eq("id", projectId).maybeSingle(),
      supabase
        .from("jobs")
        .select("id, project_id")
        .eq("id", jobId)
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);
    if (
      project.error ||
      job.error ||
      !project.data ||
      !job.data ||
      job.data.project_id !== project.data.id
    ) {
      return bulkFailure();
    }
    const targetJobId = job.data.id;

    const dates = parsed.data.shifts.map((shift) => shift.date);
    if (new Set(dates).size !== dates.length) {
      return { ok: false, fieldErrors: { shifts: "同じ勤務日が重複しています。" } };
    }

    const schedules = parsed.data.shifts.map((shift) => ({
      shift,
      schedule: buildBulkShiftSchedule(
        shift.date,
        shift.startTime,
        shift.endTime,
        shift.endsNextDay,
        shift.deadlineEnabled,
        Number(shift.deadlineDaysBefore),
        shift.deadlineTime,
      ),
    }));
    if (
      schedules.some(
        ({ schedule }) =>
          !schedule ||
          schedule.endsAt <= schedule.startsAt ||
          (schedule.applicationDeadline &&
            schedule.applicationDeadline > schedule.startsAt),
      )
    ) {
      return bulkFailure();
    }

    const validSchedules = schedules.map(({ shift, schedule }) => ({
      shift,
      schedule: schedule!,
    }));

    const rows = validSchedules.map(({ shift, schedule }) => ({
      id: crypto.randomUUID(),
      job_id: targetJobId,
      starts_at: schedule.startsAt,
      ends_at: schedule.endsAt,
      required_workers: Number(shift.requiredWorkers),
      break_minutes:
        shift.breakMinutes === ""
          ? null
          : Number(shift.breakMinutes),
      application_deadline: schedule.applicationDeadline,
      status: shift.status,
    }));
    const result = await supabase.from("shift_slots").insert(rows);
    if (result.error) throw result.error;

    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    redirect(`/admin/projects/${projectId}`);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("Failed to create bulk shifts", error);
    return bulkFailure();
  }
}
