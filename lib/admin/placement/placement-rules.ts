import { ACTIVE_ASSIGNMENT_STATUSES, buildShiftList } from "@/lib/admin/shifts/shift-list-rules";
import { isShiftDate, shiftViewRange, tokyoDate } from "@/lib/admin/shifts/shift-view-rules";
import type { PlacementAssignmentRow, PlacementQuery, PlacementShift, PlacementShiftRow, PlacementStaff } from "./placement-types";

export const PLACEMENT_PAGE_SIZE = 20;

export function parsePlacementQuery(raw: Record<string, string | string[] | undefined>, now = new Date()): PlacementQuery {
  const first = (key: string) => (Array.isArray(raw[key]) ? raw[key][0] : raw[key]) ?? "";
  // Invalid IDs remain unmatched filters, never broaden to another tenant's data.
  const id = (key: string) => first(key).slice(0, 100);
  const page = Number(first("page"));
  return {
    date: isShiftDate(first("date")) ? first("date") : tokyoDate(now),
    q: first("q").trim().slice(0, 100),
    project: id("project"),
    shift: id("shift"),
    staffing: first("staffing") === "shortage" ? "shortage" : first("staffing") === "filled" ? "filled" : "all",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function placementRange(date: string) {
  if (!isShiftDate(date)) throw new Error("Invalid placement date");
  return shiftViewRange({ view: "list", date, today: date, month: date.slice(0, 7) })!;
}

export function placementHref(query: PlacementQuery, patch: Partial<PlacementQuery> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams({ date: next.date });
  for (const key of ["q", "project", "shift"] as const) if (next[key]) params.set(key, next[key]);
  if (next.staffing !== "all") params.set("staffing", next.staffing);
  if (next.page > 1) params.set("page", String(next.page));
  return `/admin/placement?${params.toString()}`;
}

// Only RLS-visible Shift/Project objects enter the board. A hidden Worker must
// not erase its visible Assignment or reduce the staffing count.
export function buildPlacement(shifts: PlacementShiftRow[], assignments: PlacementAssignmentRow[]): PlacementShift[] {
  const visibleShifts = shifts.flatMap((row) => {
    if (!row.jobs?.projects) return [];
    return [{
      id: row.id, startsAt: row.starts_at, endsAt: row.ends_at,
      requiredWorkers: row.required_workers, status: row.status,
      projectId: row.jobs.projects.id, projectName: row.jobs.projects.name,
      jobName: row.jobs.name, workplaceName: row.jobs.workplaces?.name ?? "勤務先情報を表示できません",
      breakMinutes: row.break_minutes,
    }];
  });
  const visibleIds = new Set(visibleShifts.map((shift) => shift.id));
  const active = assignments.filter((row) => visibleIds.has(row.shift_slot_id)
    && ACTIVE_ASSIGNMENT_STATUSES.some((status) => status === row.status));
  const staffByShift = new Map<string, PlacementStaff[]>();
  for (const row of active) {
    const staff = staffByShift.get(row.shift_slot_id) ?? [];
    staff.push({ assignmentId: row.id, status: row.status, worker: row.workers
      ? { id: row.workers.id, name: row.workers.display_name, staffCode: row.workers.staff_code } : null });
    staffByShift.set(row.shift_slot_id, staff);
  }
  const details = new Map(visibleShifts.map((shift) => [shift.id, shift]));
  return buildShiftList(visibleShifts, [], active.map((row) => row.shift_slot_id), {
    q: "", period: "all", status: "all", staffing: "all",
  }).map((shift) => ({
    ...shift, projectId: details.get(shift.id)!.projectId, breakMinutes: details.get(shift.id)!.breakMinutes,
    staff: (staffByShift.get(shift.id) ?? []).sort((a, b) =>
      (a.worker?.name ?? "").localeCompare(b.worker?.name ?? "", "ja") || a.assignmentId.localeCompare(b.assignmentId)),
  })).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
}

export function filterPlacement(shifts: PlacementShift[], query: PlacementQuery) {
  const needle = query.q.toLocaleLowerCase("ja");
  return shifts.filter((shift) => (!query.project || shift.projectId === query.project)
    && (!query.shift || shift.id === query.shift)
    && (!needle || [shift.projectName, shift.jobName, shift.workplaceName].some((value) => value.toLocaleLowerCase("ja").includes(needle)))
    && (query.staffing === "all" || (query.staffing === "shortage" ? shift.shortage > 0 : shift.shortage === 0)));
}

export function summarizePlacement(shifts: PlacementShift[]) {
  return {
    shifts: shifts.length,
    required: shifts.reduce((sum, shift) => sum + shift.requiredWorkers, 0),
    assigned: shifts.reduce((sum, shift) => sum + shift.assignedWorkers, 0),
    shortage: shifts.reduce((sum, shift) => sum + shift.shortage, 0),
    filled: shifts.filter((shift) => shift.shortage === 0).length,
    shortageShifts: shifts.filter((shift) => shift.shortage > 0).length,
  };
}

export function paginatePlacement(shifts: PlacementShift[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(shifts.length / PLACEMENT_PAGE_SIZE));
  const page = Math.min(Math.max(requestedPage, 1), pages);
  return { page, pages, items: shifts.slice((page - 1) * PLACEMENT_PAGE_SIZE, page * PLACEMENT_PAGE_SIZE) };
}
