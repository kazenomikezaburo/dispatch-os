import "server-only";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/shifts/shift-list-rules";
import { readAllPages } from "@/lib/admin/shifts/read-all-pages";
import { buildPlacement, placementRange } from "./placement-rules";
import type { PlacementAssignmentRow, PlacementResult, PlacementShiftRow } from "./placement-types";

export async function getPlacement(date: string): Promise<PlacementResult> {
  // Keep redirecting authorization outside the data-error boundary.
  await requireAdmin();
  try {
    const supabase = await createClient();
    const range = placementRange(date);
    const shifts = await readAllPages<PlacementShiftRow>(async (from, to) => {
      const result = await supabase.from("shift_slots").select(`
        id, starts_at, ends_at, required_workers, break_minutes, status,
        jobs!inner(name, projects!inner(id, name), workplaces(name))
      `, { count: "exact" }).gte("starts_at", range.start).lt("starts_at", range.end)
        .order("starts_at").order("id").range(from, to);
      return result as unknown as { data: PlacementShiftRow[] | null; error: unknown; count: number | null };
    });
    const assignments: PlacementAssignmentRow[] = [];
    // Date-bounded IDs in batches; never query once per Shift or Worker.
    for (let offset = 0; offset < shifts.length; offset += 100) {
      const ids = shifts.slice(offset, offset + 100).map((shift) => shift.id);
      assignments.push(...await readAllPages<PlacementAssignmentRow>(async (from, to) => {
        const result = await supabase.from("assignments").select(`
          id, shift_slot_id, status, workers(id, display_name, staff_code)
        `, { count: "exact" }).in("shift_slot_id", ids).in("status", [...ACTIVE_ASSIGNMENT_STATUSES])
          .order("id").range(from, to);
        return result as unknown as { data: PlacementAssignmentRow[] | null; error: unknown; count: number | null };
      }));
    }
    const built = buildPlacement(shifts, assignments);
    const plans: { id: string; shift_slot_id: string; version: number }[] = [];
    for (let offset = 0; offset < shifts.length; offset += 100) {
      const ids = shifts.slice(offset, offset + 100).map((shift) => shift.id);
      if (!ids.length) continue;
      const result = await supabase.from("shift_placement_plans").select("id, shift_slot_id, version").in("shift_slot_id", ids);
      if (result.error) throw result.error; plans.push(...(result.data ?? []));
    }
    const planIds = plans.map((plan) => plan.id);
    const positions: { id: string; plan_id: string; label: string; required_workers: number | null; retired_at: string | null }[] = [];
    const segments: { plan_id: string; position_id: string; assignment_id: string }[] = [];
    for (let offset = 0; offset < planIds.length; offset += 100) {
      const ids = planIds.slice(offset, offset + 100); const [p, s] = await Promise.all([
        supabase.from("shift_positions").select("id, plan_id, label, required_workers, retired_at").in("plan_id", ids).is("retired_at", null),
        supabase.from("assignment_placement_segments").select("plan_id, position_id, assignment_id").in("plan_id", ids),
      ]); if (p.error || s.error) throw p.error ?? s.error; positions.push(...(p.data ?? [])); segments.push(...(s.data ?? []));
    }
    const planByShift = new Map(plans.map((plan) => [plan.shift_slot_id, plan]));
    return { ok: true, shifts: built.map((shift) => { const plan = planByShift.get(shift.id); if (!plan) return shift;
      const summary = positions.filter((p) => p.plan_id === plan.id).map((p) => { const placedWorkers = new Set(segments.filter((s) => s.plan_id === plan.id && s.position_id === p.id).map((s) => s.assignment_id)).size; return { id: p.id, label: p.label, requiredWorkers: p.required_workers, placedWorkers }; });
      return { ...shift, planSummary: { version: plan.version, positions: summary, warningCount: summary.filter((p) => p.requiredWorkers !== null && p.placedWorkers < p.requiredWorkers).length } }; }) };
  } catch {
    console.error("Failed to load admin placement");
    return { ok: false };
  }
}
