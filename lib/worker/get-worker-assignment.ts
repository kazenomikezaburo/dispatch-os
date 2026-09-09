import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPreShiftConfirmationState } from "@/lib/domain/pre-shift-confirmation";
import { getWorkerAttendanceState, type WorkerAttendanceEvent } from "@/lib/domain/worker-attendance";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/dashboard/dashboard-rules";
import type { HealthStatus } from "./pre-shift-confirmation-schema";
import type { WorkerAssignment, WorkerAssignmentResult } from "./worker-assignment-types";
import { getWorkerIncidentsForAssignments } from "./incidents/get-worker-incidents";

type AssignmentRow = {
  status: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
  jobs: {
    name: string;
    description: string | null;
    hourly_wage: number | null;
    transportation_fee_cap: number | null;
    dress_code: string | null;
    requirements: string | null;
    meal_notes: string | null;
    recruitment_notes: string | null;
    manual_url: string | null;
    projects: { name: string };
    workplaces: { name: string };
  };
};

export async function getCurrentWorkerId(profileId: string) {
  const supabase = await createClient();
  const result = await supabase.from("workers").select("id").eq("auth_profile_id", profileId).eq("status", "active").maybeSingle();
  if (result.error) throw result.error;
  return result.data?.id ?? null;
}

export async function getWorkerAssignment(profileId: string, assignmentId: string): Promise<WorkerAssignmentResult> {
  try {
    const supabase = await createClient();
    const workerId = await getCurrentWorkerId(profileId);
    if (!workerId) return { ok: false, reason: "not_found" };
    const assignmentResult = await supabase.from("assignments").select(`
      id, status,
      shift_slots!inner (
        status, starts_at, ends_at, break_minutes,
        jobs!inner (
          name, description, hourly_wage, transportation_fee_cap,
          dress_code, requirements, meal_notes, recruitment_notes, manual_url,
          projects!inner (name), workplaces!inner (name)
        )
      )
    `).eq("id", assignmentId).eq("worker_id", workerId).maybeSingle();
    if (assignmentResult.error) throw assignmentResult.error;
    if (!assignmentResult.data) return { ok: false, reason: "not_found" };
    const raw = assignmentResult.data as unknown as { id: string; status: WorkerAssignment["assignmentStatus"]; shift_slots: AssignmentRow };
    const row = { id: raw.id, ...raw.shift_slots };
    const confirmationResult = await supabase.from("pre_shift_confirmations").select("can_work, health_status, submitted_at").eq("assignment_id", assignmentId).maybeSingle();
    if (confirmationResult.error) throw confirmationResult.error;
    const confirmation = confirmationResult.data ? {
      canWork: confirmationResult.data.can_work,
      healthStatus: confirmationResult.data.health_status as HealthStatus,
      submittedAt: confirmationResult.data.submitted_at,
    } : null;
    const attendanceResult = await supabase.from("attendance_events").select("event_type, server_received_at").eq("assignment_id", assignmentId).in("event_type", ["start_work", "end_work"]).order("server_received_at");
    if (attendanceResult.error) throw attendanceResult.error;
    const attendanceEvents = (attendanceResult.data ?? []).map((event): WorkerAttendanceEvent => ({
      eventType: event.event_type as WorkerAttendanceEvent["eventType"],
      serverReceivedAt: event.server_received_at,
    }));
    const startEvent = attendanceEvents.find((event) => event.eventType === "start_work");
    const endEvent = attendanceEvents.find((event) => event.eventType === "end_work");
    const now = new Date();
    const incidents = (await getWorkerIncidentsForAssignments([assignmentId])).get(assignmentId) ?? [];
    const assignment: WorkerAssignment = {
      id: row.id, assignmentStatus: raw.status, shiftStatus: row.status, startsAt: row.starts_at, endsAt: row.ends_at, breakMinutes: row.break_minutes,
      projectName: row.jobs.projects.name, jobName: row.jobs.name, workplaceName: row.jobs.workplaces.name,
      description: row.jobs.description, hourlyWage: row.jobs.hourly_wage,
      transportationFeeCap: row.jobs.transportation_fee_cap, dressCode: row.jobs.dress_code,
      requirements: row.jobs.requirements, mealNotes: row.jobs.meal_notes,
      recruitmentNotes: row.jobs.recruitment_notes, manualUrl: row.jobs.manual_url,
      hasStarted: now.getTime() >= new Date(row.starts_at).getTime(),
      confirmationState: getPreShiftConfirmationState({ startsAt: row.starts_at, hasConfirmation: Boolean(confirmation), now }),
      confirmation,
      attendanceState: getWorkerAttendanceState(attendanceEvents),
      startWorkAt: startEvent?.serverReceivedAt ?? null,
      endWorkAt: endEvent?.serverReceivedAt ?? null,
      canStartWork: ["assigned", "confirmed"].includes(raw.status) && getWorkerAttendanceState(attendanceEvents) === "not_started" && now.getTime() >= new Date(row.starts_at).getTime() - 60 * 60 * 1000 && now.getTime() < new Date(row.ends_at).getTime(),
      canEndWork: ["assigned", "confirmed"].includes(raw.status) && getWorkerAttendanceState(attendanceEvents) === "working",
      canCreateIncident: ["assigned", "confirmed"].includes(raw.status) && row.status !== "cancelled",
      incidents,
    };
    return { ok: true, assignment };
  } catch (error: unknown) {
    console.error("Failed to load worker assignment", error);
    return { ok: false, reason: "error" };
  }
}

export async function getWorkerAssignments(profileId: string): Promise<{ ok: true; assignments: WorkerAssignment[] } | { ok: false }> {
  try {
    const supabase = await createClient();
    const workerId = await getCurrentWorkerId(profileId);
    if (!workerId) return { ok: false };
    const result = await supabase.from("assignments").select(`id, status, shift_slots!inner (starts_at, ends_at, break_minutes, jobs!inner (name, description, hourly_wage, transportation_fee_cap, dress_code, requirements, meal_notes, recruitment_notes, manual_url, projects!inner (name), workplaces!inner (name)))`).eq("worker_id", workerId).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]);
    if (result.error) throw result.error;
    const rows = (result.data ?? []) as unknown as { id: string; status: WorkerAssignment["assignmentStatus"]; shift_slots: AssignmentRow }[];
    const upcoming = rows.filter((item) => new Date(item.shift_slots.ends_at).getTime() >= Date.now()).sort((a, b) => a.shift_slots.starts_at.localeCompare(b.shift_slots.starts_at));
    const confirmations = upcoming.length === 0 ? { data: [], error: null } : await supabase.from("pre_shift_confirmations").select("assignment_id, can_work, health_status, submitted_at").in("assignment_id", upcoming.map((item) => item.id));
    if (confirmations.error) throw confirmations.error;
    const byAssignment = new Map((confirmations.data ?? []).map((item) => [item.assignment_id, item]));
    const attendance = upcoming.length === 0 ? { data: [], error: null } : await supabase.from("attendance_events").select("assignment_id, event_type, server_received_at").in("assignment_id", upcoming.map((item) => item.id)).in("event_type", ["start_work", "end_work"]).order("server_received_at");
    if (attendance.error) throw attendance.error;
    const attendanceByAssignment = new Map<string, WorkerAttendanceEvent[]>();
    for (const event of attendance.data ?? []) {
      const values = attendanceByAssignment.get(event.assignment_id) ?? [];
      values.push({ eventType: event.event_type as WorkerAttendanceEvent["eventType"], serverReceivedAt: event.server_received_at });
      attendanceByAssignment.set(event.assignment_id, values);
    }
    const now = new Date();
    const incidentMap = await getWorkerIncidentsForAssignments(upcoming.map((item) => item.id));
    const assignments = upcoming.map((raw): WorkerAssignment => {
      const row = { id: raw.id, ...raw.shift_slots };
      const value = byAssignment.get(row.id);
      const confirmation = value ? { canWork: value.can_work, healthStatus: value.health_status as HealthStatus, submittedAt: value.submitted_at } : null;
      const attendanceEvents = attendanceByAssignment.get(row.id) ?? [];
      const startEvent = attendanceEvents.find((event) => event.eventType === "start_work");
      const endEvent = attendanceEvents.find((event) => event.eventType === "end_work");
      const attendanceState = getWorkerAttendanceState(attendanceEvents);
      const activeForAttendance = ["assigned", "confirmed"].includes(raw.status);
      return { id: row.id, assignmentStatus: raw.status, shiftStatus: row.status, startsAt: row.starts_at, endsAt: row.ends_at, breakMinutes: row.break_minutes, projectName: row.jobs.projects.name, jobName: row.jobs.name, workplaceName: row.jobs.workplaces.name, description: row.jobs.description, hourlyWage: row.jobs.hourly_wage, transportationFeeCap: row.jobs.transportation_fee_cap, dressCode: row.jobs.dress_code, requirements: row.jobs.requirements, mealNotes: row.jobs.meal_notes, recruitmentNotes: row.jobs.recruitment_notes, manualUrl: row.jobs.manual_url, hasStarted: now.getTime() >= new Date(row.starts_at).getTime(), confirmationState: getPreShiftConfirmationState({ startsAt: row.starts_at, hasConfirmation: Boolean(confirmation), now }), confirmation, attendanceState, startWorkAt: startEvent?.serverReceivedAt ?? null, endWorkAt: endEvent?.serverReceivedAt ?? null, canStartWork: activeForAttendance && attendanceState === "not_started" && now.getTime() >= new Date(row.starts_at).getTime() - 60 * 60 * 1000 && now.getTime() < new Date(row.ends_at).getTime(), canEndWork: activeForAttendance && attendanceState === "working", canCreateIncident: activeForAttendance && row.status !== "cancelled", incidents: incidentMap.get(row.id) ?? [] };
    });
    return { ok: true, assignments };
  } catch (error: unknown) {
    console.error("Failed to load worker assignments", error);
    return { ok: false };
  }
}
