import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";
import { buildShiftDetail } from "./shift-detail-rules";
import { buildPreShiftConfirmationSummary } from "./pre-shift-confirmation-rules";
import type {
  ApplicationStatus,
  AssignmentStatus,
  ShiftDetailResult,
} from "./shift-detail-types";

type ShiftRow = {
  id: string;
  updated_at: string;
  starts_at: string;
  ends_at: string;
  required_workers: number;
  break_minutes: number | null;
  application_deadline: string | null;
  status: string;
  jobs: {
    id: string;
    name: string;
    description: string | null;
    hourly_wage: number | null;
    transportation_fee_cap: number | null;
    dress_code: string | null;
    requirements: string | null;
    meal_notes: string | null;
    recruitment_notes: string | null;
    manual_url: string | null;
    projects: { id: string; name: string };
    workplaces: { id: string; name: string };
  };
};

type ApplicationRow = {
  id: string;
  worker_id: string;
  status: string;
  applied_at: string;
  workers: { display_name: string };
};

type AssignmentRow = {
  id: string;
  worker_id: string;
  status: string;
  workers: { display_name: string };
};

type AttendanceEventRow = {
  assignment_id: string;
  server_received_at: string;
};

type ConfirmationRow = {
  assignment_id: string;
  submitted_at: string;
};

export async function getShiftDetail(shiftId: string): Promise<ShiftDetailResult> {
  try {
    const supabase = await createClient();
    const shiftResult = await supabase
      .from("shift_slots")
      .select(`
        id, updated_at, starts_at, ends_at, required_workers, break_minutes,
        application_deadline, status,
        jobs!inner (
          id, name, description, hourly_wage, transportation_fee_cap,
          dress_code, requirements, meal_notes, recruitment_notes, manual_url,
          projects!inner (id, name),
          workplaces!inner (id, name)
        )
      `)
      .eq("id", shiftId)
      .maybeSingle();
    if (shiftResult.error) throw shiftResult.error;
    if (!shiftResult.data) return { ok: false, reason: "not_found" };

    const row = shiftResult.data as unknown as ShiftRow;
    const [applicationResult, assignmentResult] = await Promise.all([
      supabase.from("shift_applications").select("id, worker_id, status, applied_at, workers!inner(display_name)").eq("shift_slot_id", shiftId),
      supabase.from("assignments").select("id, worker_id, status, workers!inner(display_name)").eq("shift_slot_id", shiftId).in("status", ["assigned", "confirmed", "completed", "absent", "no_show"]),
    ]);
    if (applicationResult.error) throw applicationResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    const applications = (applicationResult.data ?? []) as unknown as ApplicationRow[];
    const assignments = (assignmentResult.data ?? []) as unknown as AssignmentRow[];

    let startEvents: AttendanceEventRow[] = [];
    if (assignments.length > 0) {
      const eventResult = await supabase
        .from("attendance_events")
        .select("assignment_id, server_received_at")
        .in("assignment_id", assignments.map((item) => item.id))
        .eq("event_type", "start_work");
      if (eventResult.error) throw eventResult.error;
      startEvents = (eventResult.data ?? []) as AttendanceEventRow[];
    }
    const startByAssignment = new Map(startEvents.map((event) => [event.assignment_id, event.server_received_at]));
    const assignmentItems = assignments.map((item) => ({ id: item.id, workerId: item.worker_id, workerName: item.workers.display_name, status: item.status as AssignmentStatus, startWorkAt: startByAssignment.get(item.id) ?? null }));
    let confirmations: ConfirmationRow[] = [];
    if (assignmentItems.length > 0) {
      const confirmationResult = await supabase
        .from("pre_shift_confirmations")
        .select("assignment_id, submitted_at")
        .in("assignment_id", assignmentItems.map((item) => item.id));
      if (confirmationResult.error) throw confirmationResult.error;
      confirmations = (confirmationResult.data ?? []) as ConfirmationRow[];
    }

    const detail = buildShiftDetail(
      {
        id: row.id,
        updatedAt: row.updated_at,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status as ShiftStatus,
        requiredWorkers: row.required_workers,
        breakMinutes: row.break_minutes,
        applicationDeadline: row.application_deadline,
        project: { id: row.jobs.projects.id, name: row.jobs.projects.name },
        job: {
          id: row.jobs.id,
          name: row.jobs.name,
          description: row.jobs.description,
          hourlyWage: row.jobs.hourly_wage,
          transportationFeeCap: row.jobs.transportation_fee_cap,
          dressCode: row.jobs.dress_code,
          requirements: row.jobs.requirements,
          mealNotes: row.jobs.meal_notes,
          recruitmentNotes: row.jobs.recruitment_notes,
          manualUrl: row.jobs.manual_url,
        },
        workplace: { id: row.jobs.workplaces.id, name: row.jobs.workplaces.name },
      },
      applications.map((item) => ({ id: item.id, workerId: item.worker_id, workerName: item.workers.display_name, status: item.status as ApplicationStatus, appliedAt: item.applied_at })),
      assignmentItems,
    );
    return {
      ok: true,
      detail: {
        ...detail,
        editRestrictions: {
          minimumRequiredWorkers: detail.assignedWorkers,
          lockBreak: detail.assignedWorkers > 0,
          lockPlannedTime: detail.applicationCount > 0 || detail.assignedWorkers > 0 || assignmentItems.some((item) => Boolean(item.startWorkAt)) || Date.now() >= new Date(row.starts_at).getTime(),
          plannedTimeReason: "応募・配置・勤怠がある、または勤務開始済みのため予定時間を変更できません。",
        },
        preShiftConfirmations: buildPreShiftConfirmationSummary(
          row.starts_at,
          assignmentItems.filter((item) => item.status === "assigned" || item.status === "confirmed" || item.status === "completed"),
          confirmations.map((item) => ({ assignmentId: item.assignment_id, submittedAt: item.submitted_at })),
          new Date(),
        ),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to load admin shift detail", error);
    return { ok: false, reason: "error" };
  }
}
