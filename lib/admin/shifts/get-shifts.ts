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

export async function getShifts(query: ShiftQuery, now = new Date()): Promise<ShiftListResult> {
  try {
    const supabase = await createClient();
    const range = getTokyoPeriodRange(query.period, now);
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
      `);
    if (range.start) request = request.gte("starts_at", range.start);
    if (range.end) request = request.lt("starts_at", range.end);
    if (query.status !== "all") request = request.eq("status", query.status);
    const shiftResult = await request.order("starts_at", { ascending: query.period !== "past" });
    if (shiftResult.error) throw shiftResult.error;

    const rows = (shiftResult.data ?? []) as unknown as ShiftRow[];
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
    const [applications, assignments] = await Promise.all([
      supabase.from("shift_applications").select("shift_slot_id").in("shift_slot_id", shiftIds).in("status", [...ACTIVE_APPLICATION_STATUSES]),
      supabase.from("assignments").select("shift_slot_id").in("shift_slot_id", shiftIds).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]),
    ]);
    if (applications.error) throw applications.error;
    if (assignments.error) throw assignments.error;

    return {
      ok: true,
      shifts: buildShiftList(
        shifts,
        (applications.data ?? []).map((row) => row.shift_slot_id),
        (assignments.data ?? []).map((row) => row.shift_slot_id),
        query,
      ),
    };
  } catch (error: unknown) {
    console.error("Failed to load admin shift list", error);
    return { ok: false };
  }
}
