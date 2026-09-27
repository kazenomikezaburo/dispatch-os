import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPreShiftConfirmationState } from "@/lib/domain/pre-shift-confirmation";
import { getWorkerAttendanceState, type WorkerAttendanceEvent } from "@/lib/domain/worker-attendance";
import type { HealthStatus } from "./pre-shift-confirmation-schema";
import type { WorkerAssignment, WorkerAssignmentResult } from "./worker-assignment-types";
import { getWorkerIncidentsForAssignments } from "./incidents/get-worker-incidents";
import { getWorkerJourneyFacts } from "./journey/get-worker-journey-facts";
import { buildShiftTimeline, compareWorkerPrimaryActions } from "./journey/worker-journey";

type AssignmentRow = {
  status: string;
  starts_at: string;
  ends_at: string;
  meeting_at: string | null;
  break_minutes: number | null;
  jobs: {
    name: string;
    description: string | null;
    hourly_wage: number | null;
    transportation_fee_cap: number | null;
    dress_code: string | null;
    clothing_note: string | null;
    belongings_note: string | null;
    access_note: string | null;
    meeting_note: string | null;
    requirements: string | null;
    meal_notes: string | null;
    recruitment_notes: string | null;
    manual_url: string | null;
    projects: { name: string };
    workplaces: { name: string; address: string; access_note: string | null; meeting_note: string | null };
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
        status, starts_at, ends_at, meeting_at, break_minutes,
        jobs!inner (
          name, description, hourly_wage, transportation_fee_cap,
          dress_code, clothing_note, belongings_note, access_note, meeting_note, requirements, meal_notes, recruitment_notes, manual_url,
          projects!inner (name), workplaces!inner (name, address, access_note, meeting_note)
        )
      )
    `).eq("id", assignmentId).eq("worker_id", workerId).maybeSingle();
    if (assignmentResult.error) throw assignmentResult.error;
    if (!assignmentResult.data) return { ok: false, reason: "not_found" };
    const raw = assignmentResult.data as unknown as { id: string; status: WorkerAssignment["assignmentStatus"]; shift_slots: AssignmentRow };
    const row = { id: raw.id, ...raw.shift_slots };
    const [confirmationResult, attendanceResult, incidentsByAssignment, journeyByAssignment] = await Promise.all([
      supabase.from("pre_shift_confirmations").select("can_work, health_status, submitted_at, planned_wake_at, planned_departure_at").eq("assignment_id", assignmentId).maybeSingle(),
      supabase.from("attendance_events").select("event_type, server_received_at").eq("assignment_id", assignmentId).in("event_type", ["start_work", "end_work"]).order("server_received_at"),
      getWorkerIncidentsForAssignments([assignmentId]),
      getWorkerJourneyFacts([assignmentId]),
    ]);
    if (confirmationResult.error) throw confirmationResult.error;
    const confirmation = confirmationResult.data ? {
      canWork: confirmationResult.data.can_work,
      healthStatus: confirmationResult.data.health_status as HealthStatus,
      submittedAt: confirmationResult.data.submitted_at,
      plannedWakeAt: confirmationResult.data.planned_wake_at,
      plannedDepartureAt: confirmationResult.data.planned_departure_at,
    } : null;
    if (attendanceResult.error) throw attendanceResult.error;
    const attendanceEvents = (attendanceResult.data ?? []).map((event): WorkerAttendanceEvent => ({
      eventType: event.event_type as WorkerAttendanceEvent["eventType"],
      serverReceivedAt: event.server_received_at,
    }));
    const startEvent = attendanceEvents.find((event) => event.eventType === "start_work");
    const endEvent = attendanceEvents.find((event) => event.eventType === "end_work");
    const now = new Date();
    const incidents = incidentsByAssignment.get(assignmentId) ?? [];
    const journeyFacts = journeyByAssignment.get(assignmentId);
    if (!journeyFacts) return { ok: false, reason: "not_found" };
    const timeline = buildShiftTimeline(journeyFacts, incidents);
    const assignment: WorkerAssignment = {
      id: row.id, assignmentStatus: raw.status, shiftStatus: row.status, startsAt: row.starts_at, endsAt: row.ends_at, meetingAt: row.meeting_at, breakMinutes: row.break_minutes,
      projectName: row.jobs.projects.name, jobName: row.jobs.name, workplaceName: row.jobs.workplaces.name, workplaceAddress: row.jobs.workplaces.address,
      meetingNote: row.jobs.meeting_note ?? row.jobs.workplaces.meeting_note, accessNote: row.jobs.access_note ?? row.jobs.workplaces.access_note,
      description: row.jobs.description, hourlyWage: row.jobs.hourly_wage,
      transportationFeeCap: row.jobs.transportation_fee_cap, dressCode: row.jobs.dress_code ?? row.jobs.clothing_note, belongingsNote: row.jobs.belongings_note,
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
      timeline,
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
    const result = await supabase.from("assignments").select(`id, status, shift_slots!inner (status, starts_at, ends_at, meeting_at, break_minutes, jobs!inner (name, description, hourly_wage, transportation_fee_cap, dress_code, clothing_note, belongings_note, access_note, meeting_note, requirements, meal_notes, recruitment_notes, manual_url, projects!inner (name), workplaces!inner (name, address, access_note, meeting_note)))`).eq("worker_id", workerId).order("starts_at", { ascending: false, referencedTable: "shift_slots" }).limit(50);
    if (result.error) throw result.error;
    const rows = (result.data ?? []) as unknown as { id: string; status: WorkerAssignment["assignmentStatus"]; shift_slots: AssignmentRow }[];
    const ids = rows.map((item) => item.id);
    const confirmations = rows.length === 0 ? { data: [], error: null } : await supabase.from("pre_shift_confirmations").select("assignment_id, can_work, health_status, submitted_at, planned_wake_at, planned_departure_at").in("assignment_id", ids);
    if (confirmations.error) throw confirmations.error;
    const byAssignment = new Map((confirmations.data ?? []).map((item) => [item.assignment_id, item]));
    const attendance = rows.length === 0 ? { data: [], error: null } : await supabase.from("attendance_events").select("assignment_id, event_type, server_received_at").in("assignment_id", ids).in("event_type", ["start_work", "end_work"]).order("server_received_at");
    if (attendance.error) throw attendance.error;
    const attendanceByAssignment = new Map<string, WorkerAttendanceEvent[]>();
    for (const event of attendance.data ?? []) {
      const values = attendanceByAssignment.get(event.assignment_id) ?? [];
      values.push({ eventType: event.event_type as WorkerAttendanceEvent["eventType"], serverReceivedAt: event.server_received_at });
      attendanceByAssignment.set(event.assignment_id, values);
    }
    const now = new Date();
    const [incidentMap, journeyMap] = await Promise.all([getWorkerIncidentsForAssignments(ids), getWorkerJourneyFacts(ids)]);
    const assignments = rows.map((raw): WorkerAssignment => {
      const row = { id: raw.id, ...raw.shift_slots };
      const value = byAssignment.get(row.id);
      const confirmation = value ? { canWork: value.can_work, healthStatus: value.health_status as HealthStatus, submittedAt: value.submitted_at, plannedWakeAt: value.planned_wake_at, plannedDepartureAt: value.planned_departure_at } : null;
      const attendanceEvents = attendanceByAssignment.get(row.id) ?? [];
      const startEvent = attendanceEvents.find((event) => event.eventType === "start_work");
      const endEvent = attendanceEvents.find((event) => event.eventType === "end_work");
      const attendanceState = getWorkerAttendanceState(attendanceEvents);
      const activeForAttendance = ["assigned", "confirmed"].includes(raw.status);
      const facts = journeyMap.get(row.id);
      if (!facts) throw new Error("Worker journey projection unavailable");
      const incidents = incidentMap.get(row.id) ?? [];
      return { id: row.id, assignmentStatus: raw.status, shiftStatus: row.status, startsAt: row.starts_at, endsAt: row.ends_at, meetingAt: row.meeting_at, breakMinutes: row.break_minutes, projectName: row.jobs.projects.name, jobName: row.jobs.name, workplaceName: row.jobs.workplaces.name, workplaceAddress: row.jobs.workplaces.address, meetingNote: row.jobs.meeting_note ?? row.jobs.workplaces.meeting_note, accessNote: row.jobs.access_note ?? row.jobs.workplaces.access_note, description: row.jobs.description, hourlyWage: row.jobs.hourly_wage, transportationFeeCap: row.jobs.transportation_fee_cap, dressCode: row.jobs.dress_code ?? row.jobs.clothing_note, belongingsNote: row.jobs.belongings_note, requirements: row.jobs.requirements, mealNotes: row.jobs.meal_notes, recruitmentNotes: row.jobs.recruitment_notes, manualUrl: row.jobs.manual_url, hasStarted: now.getTime() >= new Date(row.starts_at).getTime(), confirmationState: getPreShiftConfirmationState({ startsAt: row.starts_at, hasConfirmation: Boolean(confirmation), now }), confirmation, attendanceState, startWorkAt: startEvent?.serverReceivedAt ?? null, endWorkAt: endEvent?.serverReceivedAt ?? null, canStartWork: activeForAttendance && attendanceState === "not_started" && now.getTime() >= new Date(row.starts_at).getTime() - 60 * 60 * 1000 && now.getTime() < new Date(row.ends_at).getTime(), canEndWork: activeForAttendance && attendanceState === "working", canCreateIncident: activeForAttendance && row.status !== "cancelled", incidents, timeline: buildShiftTimeline(facts, incidents) };
    });
    assignments.sort((a, b) => compareWorkerPrimaryActions({ id: a.id, startsAt: a.startsAt, timeline: a.timeline }, { id: b.id, startsAt: b.startsAt, timeline: b.timeline }));
    return { ok: true, assignments };
  } catch (error: unknown) {
    console.error("Failed to load worker assignments", error);
    return { ok: false };
  }
}
