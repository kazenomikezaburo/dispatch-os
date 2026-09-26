import "server-only";

import { createClient } from "@/lib/supabase/server";

export type RecruitmentShift = {
  shiftId: string; projectName: string; jobName: string; label: string | null; startsAt: string; endsAt: string; meetingAt: string | null; applicationDeadline: string;
  workplaceName: string; workplaceAddress: string; accessNote: string | null; meetingNote: string | null; description: string | null; clothingNote: string | null; belongingsNote: string | null; mealNotes: string | null;
  hourlyWage: number | null; transportationFeeCap: number | null; transportType: string; transportAmount: number | null; transportMaxAmount: number | null; recruitmentNotes: string | null; manualUrl: string | null; mapUrl: string | null; requirementsText: string | null;
  requirements: { kind: "skill" | "qualification"; name: string }[]; remainingCapacity: number; applicationState: "applied" | "accepted" | "rejected" | "withdrawn" | null;
  state: "available" | "available_with_warning" | "not_eligible" | "applied" | "accepted_waiting_assignment" | "rejected" | "withdrawn" | "capacity_full" | "deadline_passed";
  eligibility: { availabilityState: string | null; safeReasons: string[] };
};
type Projection = { ok: boolean; items: RecruitmentShift[]; hasMore: boolean };

export async function getWorkerRecruitment(page = 0): Promise<Projection> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_own_recruitment_shifts", { p_limit: 24, p_offset: Math.max(0, page) * 24, p_shift_id: null });
  if (error) throw error;
  return data as Projection;
}

export async function getWorkerRecruitmentShift(shiftId: string): Promise<RecruitmentShift | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_own_recruitment_shifts", { p_limit: 1, p_offset: 0, p_shift_id: shiftId });
  if (error) throw error;
  const result = data as Projection;
  return result.items[0] ?? null;
}
