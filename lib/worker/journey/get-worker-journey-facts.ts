import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WorkerJourneyFacts } from "./worker-journey";

type Row = {
  assignment_id: string; shift_id: string; generated_at: string; assignment_status: string; shift_status: string;
  starts_at: string; ends_at: string; arrival_target: string; has_confirmation: boolean; confirmation_submitted_at: string | null;
  planned_wake_at: string | null; planned_departure_at: string | null;
  wake_operation: "recorded" | "voided" | null; wake_occurred_at: string | null; wake_timeliness: "early_or_on_time" | "late" | null;
  departure_operation: "recorded" | "voided" | null; departure_occurred_at: string | null; departure_timeliness: "early_or_on_time" | "late" | null;
  arrival_operation: "recorded" | "voided" | null; arrival_occurred_at: string | null; arrival_timeliness: "early_or_on_time" | "late" | null;
  start_work_at: string | null; end_work_at: string | null; placement_labels: string[];
};

export async function getWorkerJourneyFacts(assignmentIds: string[]) {
  const values = [...new Set(assignmentIds)].slice(0, 50);
  const map = new Map<string, WorkerJourneyFacts>();
  if (!values.length) return map;
  const supabase = await createClient();
  const result = await supabase.rpc("get_own_assignment_journey_facts", { p_assignment_ids: values });
  if (result.error) throw result.error;
  for (const row of (result.data ?? []) as Row[]) map.set(row.assignment_id, {
    assignmentId: row.assignment_id, shiftId: row.shift_id, generatedAt: row.generated_at, assignmentStatus: row.assignment_status, shiftStatus: row.shift_status,
    startsAt: row.starts_at, endsAt: row.ends_at, arrivalTarget: row.arrival_target, hasConfirmation: row.has_confirmation, confirmationSubmittedAt: row.confirmation_submitted_at,
    plannedWakeAt: row.planned_wake_at, plannedDepartureAt: row.planned_departure_at,
    wake: { operation: row.wake_operation, occurredAt: row.wake_occurred_at, timeliness: row.wake_timeliness },
    departure: { operation: row.departure_operation, occurredAt: row.departure_occurred_at, timeliness: row.departure_timeliness },
    arrival: { operation: row.arrival_operation, occurredAt: row.arrival_occurred_at, timeliness: row.arrival_timeliness },
    startWorkAt: row.start_work_at, endWorkAt: row.end_work_at, placementLabels: row.placement_labels ?? [],
  });
  return map;
}
