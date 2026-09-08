import "server-only";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import type { PlacementBreak, PlacementPlan, PlacementPosition, PlacementSegment, PlacementStaff } from "./placement-types";

type PlanRow = { id: string; version: number };
type PositionRow = { id: string; label: string; required_workers: number | null; display_order: number; retired_at: string | null };
type SegmentRow = { id: string; assignment_id: string; position_id: string; start_at: string; end_at: string };
type BreakRow = { id: string; assignment_id: string; start_at: string; end_at: string };
type AssignmentRow = { id: string; status: PlacementStaff["status"]; workers: { id: string; display_name: string; staff_code: string } | null };

export async function getPlacementPlan(shiftId: string): Promise<PlacementPlan | null> {
  await requireAdmin();
  const supabase = await createClient();
  const shiftResult = await supabase.from("shift_slots").select("id, starts_at, ends_at, required_workers, break_minutes").eq("id", shiftId).maybeSingle();
  if (shiftResult.error || !shiftResult.data) return null;
  const assignmentResult = await supabase.from("assignments").select("id, status, workers(id, display_name, staff_code)")
    .eq("shift_slot_id", shiftId).in("status", ["assigned", "confirmed", "completed"]).order("id");
  if (assignmentResult.error) throw assignmentResult.error;
  const planResult = await supabase.from("shift_placement_plans").select("id, version").eq("shift_slot_id", shiftId).maybeSingle();
  if (planResult.error) throw planResult.error;
  const plan = planResult.data as PlanRow | null;
  let positions: PlacementPosition[] = [], segments: PlacementSegment[] = [], breaks: PlacementBreak[] = [];
  if (plan) {
    const [p, s, b] = await Promise.all([
      supabase.from("shift_positions").select("id, label, required_workers, display_order, retired_at").eq("plan_id", plan.id).order("display_order"),
      supabase.from("assignment_placement_segments").select("id, assignment_id, position_id, start_at, end_at").eq("plan_id", plan.id).order("start_at"),
      supabase.from("assignment_break_intervals").select("id, assignment_id, start_at, end_at").eq("plan_id", plan.id).order("start_at"),
    ]);
    if (p.error || s.error || b.error) throw p.error ?? s.error ?? b.error;
    positions = (p.data as PositionRow[]).map((row) => ({ id: row.id, label: row.label, requiredWorkers: row.required_workers, displayOrder: row.display_order, retired: row.retired_at !== null }));
    segments = (s.data as SegmentRow[]).map((row) => ({ id: row.id, assignmentId: row.assignment_id, positionId: row.position_id, startAt: row.start_at, endAt: row.end_at }));
    breaks = (b.data as BreakRow[]).map((row) => ({ id: row.id, assignmentId: row.assignment_id, startAt: row.start_at, endAt: row.end_at }));
  }
  const assignments = (assignmentResult.data as unknown as AssignmentRow[]).map((row) => ({ assignmentId: row.id, status: row.status, worker: row.workers ? { id: row.workers.id, name: row.workers.display_name, staffCode: row.workers.staff_code } : null }));
  return { planId: plan?.id ?? null, version: plan?.version ?? 0, shiftId, startsAt: shiftResult.data.starts_at, endsAt: shiftResult.data.ends_at,
    requiredWorkers: shiftResult.data.required_workers, breakMinutes: shiftResult.data.break_minutes,
    correctionRequired: Date.now() >= Date.parse(shiftResult.data.starts_at), positions, segments, breaks, assignments };
}
