// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { addDays, isShiftDate, tokyoDate } from "../shifts/shift-view-rules.ts";

export type PreShiftStatus = "all" | "pending" | "confirmed";
export type PreShiftQuery = { date: string; q: string; project: string; status: PreShiftStatus; assignment: string };
export type PreShiftItem = {
  assignmentId: string; assignmentStatus: string; workerId: string; workerName: string;
  shiftId: string; startsAt: string; endsAt: string; projectId: string; projectName: string;
  jobId: string; jobName: string; workplaceId: string; workplaceName: string;
  confirmation: null | { canWork: boolean; healthStatus: "good" | "concern" | "unwell"; plannedWakeAt: string | null; plannedDepartureAt: string | null; comment: string | null; submittedAt: string; updatedAt: string };
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
export function parsePreShiftQuery(raw: Record<string, string | string[] | undefined>, now = new Date()): PreShiftQuery {
  const tomorrow = addDays(tokyoDate(now), 1);
  const date = first(raw.date);
  const status = first(raw.status);
  return { date: isShiftDate(date) ? date : tomorrow, q: first(raw.q).trim().slice(0, 100), project: first(raw.project), status: status === "pending" || status === "confirmed" ? status : "all", assignment: first(raw.assignment) };
}
export function preShiftRange(date: string) { return { start: new Date(`${date}T00:00:00+09:00`).toISOString(), end: new Date(`${addDays(date, 1)}T00:00:00+09:00`).toISOString() }; }
export function filterPreShiftItems(items: PreShiftItem[], query: PreShiftQuery) {
  const needle = query.q.toLocaleLowerCase("ja");
  return items.filter((item) => (!needle || `${item.workerName} ${item.projectName}`.toLocaleLowerCase("ja").includes(needle)) && (!query.project || item.projectId === query.project) && (query.status === "all" || (query.status === "confirmed") === Boolean(item.confirmation))).sort((a,b) => Number(Boolean(a.confirmation)) - Number(Boolean(b.confirmation)) || a.startsAt.localeCompare(b.startsAt) || a.workerName.localeCompare(b.workerName,"ja") || a.assignmentId.localeCompare(b.assignmentId));
}
export function preShiftHref(query: PreShiftQuery, patch: Partial<PreShiftQuery> = {}) {
  const next = { ...query, ...patch }; const params = new URLSearchParams({ date: next.date });
  if (next.q) params.set("q", next.q); if (next.project) params.set("project", next.project); if (next.status !== "all") params.set("status", next.status); if (next.assignment) params.set("assignment", next.assignment);
  return `/admin/pre-shift?${params}`;
}
