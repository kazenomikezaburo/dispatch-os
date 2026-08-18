import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildDashboardData } from "./dashboard-rules";
import type {
  DashboardAssignmentInput,
  DashboardDataResult,
  DashboardShiftInput,
} from "./dashboard-types";

type ShiftRow = {
  id: string;
  job_id: string;
  starts_at: string;
  ends_at: string;
  required_workers: number;
  jobs: {
    id: string;
    projects: { name: string };
    workplaces: { name: string };
  };
};

type AssignmentRow = {
  id: string;
  shift_slot_id: string;
  worker_id: string;
  status: string;
  workers: { display_name: string };
};

export function getTokyoDayRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const tokyoOffsetMilliseconds = 9 * 60 * 60 * 1000;

  return {
    start: new Date(Date.UTC(year, month - 1, day) - tokyoOffsetMilliseconds),
    end: new Date(Date.UTC(year, month - 1, day + 1) - tokyoOffsetMilliseconds),
  };
}

export async function getDashboardData(now = new Date()): Promise<DashboardDataResult> {
  try {
    const supabase = await createClient();
    const range = getTokyoDayRange(now);
    const { data: shiftData, error: shiftError } = await supabase
      .from("shift_slots")
      .select(`
        id,
        job_id,
        starts_at,
        ends_at,
        required_workers,
        jobs!inner (
          id,
          projects!inner (name),
          workplaces!inner (name)
        )
      `)
      .gte("starts_at", range.start.toISOString())
      .lt("starts_at", range.end.toISOString())
      .order("starts_at", { ascending: true });

    if (shiftError) throw shiftError;

    const shiftRows = (shiftData ?? []) as unknown as ShiftRow[];
    const shifts: DashboardShiftInput[] = shiftRows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      requiredWorkers: row.required_workers,
      projectName: row.jobs.projects.name,
      workplaceName: row.jobs.workplaces.name,
    }));

    if (shifts.length === 0) {
      return {
        ok: true,
        data: buildDashboardData({
          now,
          shifts: [],
          assignments: [],
          startWorkAssignmentIds: new Set(),
          confirmedAssignmentIds: new Set(),
        }),
      };
    }

    const shiftIds = shifts.map((shift) => shift.id);
    const { data: assignmentData, error: assignmentError } = await supabase
      .from("assignments")
      .select("id, shift_slot_id, worker_id, status, workers!inner(display_name)")
      .in("shift_slot_id", shiftIds);

    if (assignmentError) throw assignmentError;

    const assignmentRows = (assignmentData ?? []) as unknown as AssignmentRow[];
    const assignments: DashboardAssignmentInput[] = assignmentRows.map((row) => ({
      id: row.id,
      shiftSlotId: row.shift_slot_id,
      workerId: row.worker_id,
      workerName: row.workers.display_name,
      status: row.status,
    }));
    const assignmentIds = assignments.map((assignment) => assignment.id);

    if (assignmentIds.length === 0) {
      return {
        ok: true,
        data: buildDashboardData({
          now,
          shifts,
          assignments: [],
          startWorkAssignmentIds: new Set(),
          confirmedAssignmentIds: new Set(),
        }),
      };
    }

    const [eventsResult, confirmationsResult] = await Promise.all([
      supabase
        .from("attendance_events")
        .select("assignment_id")
        .in("assignment_id", assignmentIds)
        .eq("event_type", "start_work"),
      supabase
        .from("pre_shift_confirmations")
        .select("assignment_id")
        .in("assignment_id", assignmentIds),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (confirmationsResult.error) throw confirmationsResult.error;

    return {
      ok: true,
      data: buildDashboardData({
        now,
        shifts,
        assignments,
        startWorkAssignmentIds: new Set(
          (eventsResult.data ?? []).map((event) => event.assignment_id),
        ),
        confirmedAssignmentIds: new Set(
          (confirmationsResult.data ?? []).map(
            (confirmation) => confirmation.assignment_id,
          ),
        ),
      }),
    };
  } catch (error: unknown) {
    console.error("Failed to load admin dashboard data", error);
    return { ok: false };
  }
}
