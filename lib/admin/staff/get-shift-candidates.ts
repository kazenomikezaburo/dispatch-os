import "server-only";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { candidateAssignmentDecision, type ShiftCandidate, type ShiftCandidateResult } from "./candidate-picker-types";

type CandidateRpc = {
  ok?: boolean;
  sourceAvailable?: boolean;
  items?: ShiftCandidate[];
  truncated?: boolean;
  limit?: number;
};

type ApplicationRow = {
  worker_id: string;
  status: "applied" | "accepted" | "rejected" | "withdrawn";
};

export async function getShiftCandidates(shiftId: string): Promise<ShiftCandidateResult> {
  await requireAdmin();
  try {
    const supabase = await createClient();
    const response = await supabase.rpc("list_shift_candidate_eligibility", {
      p_shift_id: shiftId,
      p_limit: 100,
    });
    if (response.error) throw response.error;
    const data = response.data as CandidateRpc | null;
    if (!data?.ok || !data.sourceAvailable) {
      return { ok: false, sourceAvailable: false, items: [], truncated: false, limit: 100 };
    }
    const items = Array.isArray(data.items) ? data.items : [];
    const workerIds = items.map((item) => item.workerId);
    const applications = workerIds.length === 0
      ? { data: [] as ApplicationRow[], error: null }
      : await supabase.from("shift_applications").select("worker_id, status")
        .eq("shift_slot_id", shiftId).in("worker_id", workerIds);
    if (applications.error) throw applications.error;
    const applicationByWorker = new Map(
      (applications.data as ApplicationRow[]).map((row) => [row.worker_id, row.status]),
    );
    return {
      ok: true,
      sourceAvailable: true,
      items: items.map((item) => ({
        ...item,
        assignmentDecision: candidateAssignmentDecision(
          item.facts.targetShiftAssignment.state,
          applicationByWorker.get(item.workerId),
        ),
      })),
      truncated: data.truncated === true,
      limit: typeof data.limit === "number" ? data.limit : 100,
    };
  } catch (error) {
    console.error("Failed to load Shift candidates", error);
    return { ok: false, sourceAvailable: false, items: [], truncated: false, limit: 100 };
  }
}
