import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveJourneyState, type JourneyType, type WorkerJourneyFacts } from "@/lib/worker/journey/worker-journey";

export type AdminJourneyAttentionType = `${JourneyType}_overdue`;

export type AdminJourneyAttention = {
  type: AdminJourneyAttentionType;
  assignmentId: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  staffCode: string;
  projectId: string;
  projectName: string;
  jobId: string;
  jobName: string;
  workplaceName: string;
  startsAt: string;
  arrivalTarget: string;
  targetAt: string;
  generatedAt: string;
  overdueMinutes: number;
};

type Row = {
  assignment_id: string; shift_id: string; worker_id: string; worker_name: string; staff_code: string;
  project_id: string; project_name: string; job_id: string; job_name: string; workplace_name: string;
  generated_at: string; assignment_status: string; shift_status: string; starts_at: string; ends_at: string;
  arrival_target: string; has_confirmation: boolean; confirmation_submitted_at: string | null;
  planned_wake_at: string | null; planned_departure_at: string | null;
  wake_operation: "recorded" | "voided" | null; wake_occurred_at: string | null; wake_timeliness: "early_or_on_time" | "late" | null;
  departure_operation: "recorded" | "voided" | null; departure_occurred_at: string | null; departure_timeliness: "early_or_on_time" | "late" | null;
  arrival_operation: "recorded" | "voided" | null; arrival_occurred_at: string | null; arrival_timeliness: "early_or_on_time" | "late" | null;
  start_work_at: string | null; end_work_at: string | null;
};

export async function getAdminJourneyAttention(supabase: SupabaseClient, from: string, to: string) {
  const { data, error } = await supabase.rpc("get_admin_assignment_journey_facts", { p_from: from, p_to: to, p_limit: 500 });
  if (error) throw error;
  const result: AdminJourneyAttention[] = [];
  for (const row of (data ?? []) as Row[]) {
    const facts = toFacts(row);
    for (const type of ["wake", "departure", "arrival"] as const) {
      const current = deriveJourneyState(facts, type);
      if (current.state !== "overdue" || !current.dueAt) continue;
      result.push({
        type: `${type}_overdue`, assignmentId: row.assignment_id, shiftId: row.shift_id,
        workerId: row.worker_id, workerName: row.worker_name, staffCode: row.staff_code,
        projectId: row.project_id, projectName: row.project_name, jobId: row.job_id, jobName: row.job_name,
        workplaceName: row.workplace_name, startsAt: row.starts_at, arrivalTarget: row.arrival_target, targetAt: current.dueAt,
        generatedAt: row.generated_at,
        overdueMinutes: Math.max(0, Math.floor((Date.parse(row.generated_at) - Date.parse(current.dueAt)) / 60_000)),
      });
    }
  }
  return result;
}

function toFacts(row: Row): WorkerJourneyFacts {
  return {
    assignmentId: row.assignment_id, shiftId: row.shift_id, generatedAt: row.generated_at,
    assignmentStatus: row.assignment_status, shiftStatus: row.shift_status,
    startsAt: row.starts_at, endsAt: row.ends_at, arrivalTarget: row.arrival_target,
    hasConfirmation: row.has_confirmation, confirmationSubmittedAt: row.confirmation_submitted_at,
    plannedWakeAt: row.planned_wake_at, plannedDepartureAt: row.planned_departure_at,
    wake: { operation: row.wake_operation, occurredAt: row.wake_occurred_at, timeliness: row.wake_timeliness },
    departure: { operation: row.departure_operation, occurredAt: row.departure_occurred_at, timeliness: row.departure_timeliness },
    arrival: { operation: row.arrival_operation, occurredAt: row.arrival_occurred_at, timeliness: row.arrival_timeliness },
    startWorkAt: row.start_work_at, endWorkAt: row.end_work_at, placementLabels: [],
  };
}
