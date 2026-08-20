"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { shiftFormSchema, tokyoLocalToIso, type ShiftFormValues } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftCreateResult } from "@/lib/admin/projects/shift-form-types";
import {
  bulkShiftFormSchema,
  buildBulkShiftSchedule,
  type BulkShiftFormValues,
} from "@/lib/admin/projects/bulk-shift-form-schema";
import type { BulkShiftCreateResult } from "@/lib/admin/projects/bulk-shift-form-types";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (): ShiftCreateResult => ({ ok: false, message: "シフトを追加できませんでした。入力内容を確認して再度お試しください。" });
export async function createShift(projectId: string, jobId: string, input: unknown): Promise<ShiftCreateResult> {
  if (!uuid.test(projectId) || !uuid.test(jobId)) return failure();
  const parsed = shiftFormSchema.safeParse(input);
  if (!parsed.success) { const fieldErrors: ShiftCreateResult["fieldErrors"] = {}; for (const issue of parsed.error.issues) { const field = issue.path[0]; if (typeof field === "string" && !(field in fieldErrors)) fieldErrors[field as keyof ShiftFormValues] = issue.message; } return { ok: false, fieldErrors }; }
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
    redirect(`/admin/projects/${projectId}`);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    console.error("Failed to create shift", error);
    return failure();
  }
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
  if (!uuid.test(projectId) || !uuid.test(jobId)) return bulkFailure();

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

    const dates = [...parsed.data.dates].sort();
    if (new Set(dates).size !== dates.length) {
      return { ok: false, fieldErrors: { dates: "同じ勤務日が重複しています。" } };
    }

    const schedules = dates.map((date) => ({
      date,
      schedule: buildBulkShiftSchedule(
        date,
        parsed.data.startTime,
        parsed.data.endTime,
        parsed.data.endsNextDay,
        parsed.data.deadlineEnabled,
        Number(parsed.data.deadlineDaysBefore),
        parsed.data.deadlineTime,
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

    const validSchedules = schedules.map(({ date, schedule }) => ({
      date,
      schedule: schedule!,
    }));
    const generatedKeys = validSchedules.map(
      ({ schedule }) => `${schedule.startsAt}|${schedule.endsAt}`,
    );
    if (new Set(generatedKeys).size !== generatedKeys.length) {
      return { ok: false, fieldErrors: { dates: "同じ勤務日が重複しています。" } };
    }

    const existing = await supabase
      .from("shift_slots")
      .select("starts_at, ends_at")
      .eq("job_id", targetJobId)
      .in(
        "starts_at",
        validSchedules.map(({ schedule }) => schedule.startsAt),
      );
    if (existing.error) throw existing.error;
    const existingKeys = new Set(
      (existing.data ?? []).map(
        (shift) =>
          `${new Date(shift.starts_at).toISOString()}|${new Date(shift.ends_at).toISOString()}`,
      ),
    );
    if (generatedKeys.some((key) => existingKeys.has(key))) {
      return bulkFailure("既に同じ日時のシフトがあります。勤務日を確認してください。");
    }

    const rows = validSchedules.map(({ schedule }) => ({
      id: crypto.randomUUID(),
      job_id: targetJobId,
      starts_at: schedule.startsAt,
      ends_at: schedule.endsAt,
      required_workers: Number(parsed.data.requiredWorkers),
      break_minutes:
        parsed.data.breakMinutes === ""
          ? null
          : Number(parsed.data.breakMinutes),
      application_deadline: schedule.applicationDeadline,
      status: parsed.data.status,
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
