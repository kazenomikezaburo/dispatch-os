import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";
import {
  ACTIVE_APPLICATION_STATUSES,
  ACTIVE_ASSIGNMENT_STATUSES,
  buildShiftList,
  getTokyoPeriodRange,
  type ShiftListInput,
} from "./shift-list-rules";
import type { ShiftListResult, ShiftQuery } from "./shift-list-types";
import type { ShiftDateRange } from "./shift-view-rules";
import { readAllPages } from "./read-all-pages";

type ShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  required_workers: number;
  status: string;
  jobs: {
    name: string;
    projects: { name: string };
    workplaces: { name: string };
  };
};

export async function getShifts(query: ShiftQuery, now = new Date(), dateRange?: ShiftDateRange): Promise<ShiftListResult> {
  try {
    const supabase = await createClient();
    const range = dateRange ?? getTokyoPeriodRange(query.period, now);
    let request = supabase
      .from("shift_slots")
      .select(`
        id,
        starts_at,
        ends_at,
        required_workers,
        status,
        jobs!inner (
          name,
          projects!inner (name),
          workplaces!inner (name)
        )
      `, { count: "exact" });
    if (range.start) request = request.gte("starts_at", range.start);
    if (range.end) request = request.lt("starts_at", range.end);
    if (query.status !== "all") request = request.eq("status", query.status);
    const ordered = request.order("starts_at", { ascending: !!dateRange || query.period !== "past" }).order("id");
    const rows = await readAllPages((from, to) => ordered.range(from, to)) as unknown as ShiftRow[];
    const shifts: ShiftListInput[] = rows.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      projectName: row.jobs.projects.name,
      jobName: row.jobs.name,
      workplaceName: row.jobs.workplaces.name,
      requiredWorkers: row.required_workers,
      status: row.status as ShiftStatus,
    }));
    if (shifts.length === 0) return { ok: true, shifts: [] };

    const shiftIds = shifts.map((shift) => shift.id);
    const applicationIds: string[] = [];
    const assignmentIds: string[] = [];
    // Batch IDs, not days or individual shifts; keep URLs bounded and avoid N+1.
    for (let offset = 0; offset < shiftIds.length; offset += 100) {
      const ids = shiftIds.slice(offset, offset + 100);
      const [applications, assignments] = await Promise.all([
        readAllPages((from, to) => supabase.from("shift_applications").select("shift_slot_id", { count: "exact" }).in("shift_slot_id", ids).in("status", [...ACTIVE_APPLICATION_STATUSES]).order("id").range(from, to)),
        readAllPages((from, to) => supabase.from("assignments").select("shift_slot_id", { count: "exact" }).in("shift_slot_id", ids).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]).order("id").range(from, to)),
      ]);
      applicationIds.push(...applications.map((row) => row.shift_slot_id));
      assignmentIds.push(...assignments.map((row) => row.shift_slot_id));
    }

    return {
      ok: true,
      shifts: buildShiftList(
        shifts,
        applicationIds,
        assignmentIds,
        query,
      ),
    };
  } catch (error: unknown) {
    console.error("Failed to load admin shift list", error);
    return { ok: false };
  }
}
