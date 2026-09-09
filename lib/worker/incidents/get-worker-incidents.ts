import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OperationalIncidentCategory, OperationalIncidentState, WorkerOperationalIncident } from "./worker-incident-ui";

type IncidentRow = {
  id: string;
  assignment_id: string;
  category: string;
  message: string | null;
  state: string;
  version: number;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  retracted_at: string | null;
};

export async function getWorkerIncidentsForAssignments(assignmentIds: string[]) {
  const byAssignment = new Map<string, WorkerOperationalIncident[]>();
  if (assignmentIds.length === 0) return byAssignment;
  const supabase = await createClient();
  const result = await supabase.from("operational_incidents").select("id, assignment_id, category, message, state, version, created_at, acknowledged_at, resolved_at, retracted_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (result.error) throw result.error;
  for (const row of (result.data ?? []) as IncidentRow[]) {
    const incidents = byAssignment.get(row.assignment_id) ?? [];
    incidents.push({
      id: row.id,
      assignmentId: row.assignment_id,
      category: row.category as OperationalIncidentCategory,
      message: row.message,
      state: row.state as OperationalIncidentState,
      version: row.version,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      retractedAt: row.retracted_at,
    });
    byAssignment.set(row.assignment_id, incidents);
  }
  return byAssignment;
}
