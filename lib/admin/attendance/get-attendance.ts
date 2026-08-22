import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildAttendanceData } from "./attendance-rules";
import { getTokyoDateRange } from "./attendance-query-schema";
import type { AttendanceInput, AttendanceQuery, AttendanceResult } from "./attendance-types";

const INCLUDED_STATUSES = ["assigned", "confirmed", "completed", "absent", "no_show"] as const;
type Row = { id: string; shift_slot_id: string; status: string; workers: { display_name: string }; shift_slots: { starts_at: string; ends_at: string; jobs: { name: string; projects: { name: string }; workplaces: { name: string } } } };
export async function getAttendance(query: AttendanceQuery, now = new Date()): Promise<AttendanceResult> {
  try {
    const supabase = await createClient(); const range = getTokyoDateRange(query.date);
    const assignments = await supabase.from("assignments").select(`id, shift_slot_id, status, workers!inner(display_name), shift_slots!inner(starts_at, ends_at, jobs!inner(name, projects!inner(name), workplaces!inner(name)))`).in("status", [...INCLUDED_STATUSES]).gte("shift_slots.starts_at", range.start).lt("shift_slots.starts_at", range.end).order("id");
    if (assignments.error) throw assignments.error;
    const rows = (assignments.data ?? []) as unknown as Row[]; if (rows.length === 0) return { ok: true, data: buildAttendanceData([], query, now) };
    const events = await supabase.from("attendance_events").select("assignment_id, event_type, server_received_at").in("assignment_id", rows.map((row) => row.id)).in("event_type", ["start_work", "end_work"]).order("server_received_at");
    if (events.error) throw events.error;
    const eventMap = new Map<string, { start: string | null; end: string | null }>();
    for (const event of events.data ?? []) { const value = eventMap.get(event.assignment_id) ?? { start: null, end: null }; if (event.event_type === "start_work") { if (value.start) throw new Error("Duplicate start event"); value.start = event.server_received_at; } else { if (value.end) throw new Error("Duplicate end event"); value.end = event.server_received_at; } eventMap.set(event.assignment_id, value); }
    const inputs: AttendanceInput[] = rows.map((row) => { const event = eventMap.get(row.id); return { id: row.id, shiftId: row.shift_slot_id, status: row.status, workerName: row.workers.display_name, startsAt: row.shift_slots.starts_at, endsAt: row.shift_slots.ends_at, projectName: row.shift_slots.jobs.projects.name, jobName: row.shift_slots.jobs.name, workplaceName: row.shift_slots.jobs.workplaces.name, startWorkAt: event?.start ?? null, endWorkAt: event?.end ?? null }; });
    return { ok: true, data: buildAttendanceData(inputs, query, now) };
  } catch (error: unknown) { console.error("Failed to load admin attendance", error); return { ok: false }; }
}
