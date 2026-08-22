import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceDetailResult } from "./attendance-detail-types";

type AssignmentRow = { id: string; shift_slot_id: string; status: string; workers: { display_name: string }; shift_slots: { starts_at: string; ends_at: string; break_minutes: number | null; jobs: { name: string; projects: { name: string }; workplaces: { name: string } } } };
type RevisionRow = { id: string; before_actual_start_at: string; before_actual_end_at: string; before_break_minutes: number; after_actual_start_at: string; after_actual_end_at: string; after_break_minutes: number; reason: string; changed_at: string; profiles: { display_name: string } };
type RecordRow = { id: string; actual_start_at: string; actual_end_at: string; total_break_minutes: number; status: string; approved_at: string; adjustment_reason: string | null; profiles: { display_name: string }; attendance_record_revisions: RevisionRow[] };

export async function getAttendanceDetail(assignmentId: string): Promise<AttendanceDetailResult> {
  try {
    const supabase = await createClient();
    const assignmentResult = await supabase.from("assignments").select(`id, shift_slot_id, status, workers!inner(display_name), shift_slots!inner(starts_at, ends_at, break_minutes, jobs!inner(name, projects!inner(name), workplaces!inner(name)))`).eq("id", assignmentId).maybeSingle();
    if (assignmentResult.error) throw assignmentResult.error;
    if (!assignmentResult.data) return { ok: false, reason: "not_found" };
    const row = assignmentResult.data as unknown as AssignmentRow;
    const [eventsResult, recordResult] = await Promise.all([
      supabase.from("attendance_events").select("event_type, server_received_at").eq("assignment_id", assignmentId).in("event_type", ["start_work", "end_work"]).order("server_received_at"),
      supabase.from("attendance_records").select("id, actual_start_at, actual_end_at, total_break_minutes, status, approved_at, adjustment_reason, profiles!attendance_records_approved_by_fkey(display_name), attendance_record_revisions(id, before_actual_start_at, before_actual_end_at, before_break_minutes, after_actual_start_at, after_actual_end_at, after_break_minutes, reason, changed_at, profiles!attendance_record_revisions_changed_by_fkey(display_name))").eq("assignment_id", assignmentId).order("changed_at", { referencedTable: "attendance_record_revisions", ascending: false }).order("id", { referencedTable: "attendance_record_revisions", ascending: false }).maybeSingle(),
    ]);
    if (eventsResult.error || recordResult.error) throw eventsResult.error ?? recordResult.error;
    const start = eventsResult.data?.find((event) => event.event_type === "start_work")?.server_received_at ?? null;
    const end = eventsResult.data?.find((event) => event.event_type === "end_work")?.server_received_at ?? null;
    const record = recordResult.data as unknown as RecordRow | null;
    const revisions = record?.attendance_record_revisions ?? [];
    return { ok: true, detail: { assignmentId: row.id, shiftId: row.shift_slot_id, assignmentStatus: row.status, workerName: row.workers.display_name, projectName: row.shift_slots.jobs.projects.name, jobName: row.shift_slots.jobs.name, workplaceName: row.shift_slots.jobs.workplaces.name, plannedStartAt: row.shift_slots.starts_at, plannedEndAt: row.shift_slots.ends_at, plannedBreakMinutes: row.shift_slots.break_minutes ?? 0, startWorkAt: start, endWorkAt: end, record: record ? { id: record.id, actualStartAt: record.actual_start_at, actualEndAt: record.actual_end_at, breakMinutes: record.total_break_minutes, status: record.status, approvedAt: record.approved_at, approvedByName: record.profiles.display_name, adjustmentReason: record.adjustment_reason } : null, revisions: revisions.map((revision) => ({ id: revision.id, beforeActualStartAt: revision.before_actual_start_at, beforeActualEndAt: revision.before_actual_end_at, beforeBreakMinutes: revision.before_break_minutes, afterActualStartAt: revision.after_actual_start_at, afterActualEndAt: revision.after_actual_end_at, afterBreakMinutes: revision.after_break_minutes, reason: revision.reason, changedAt: revision.changed_at, changedByName: revision.profiles.display_name })) } };
  } catch (error: unknown) { console.error("Failed to load attendance detail", error); return { ok: false, reason: "error" }; }
}
