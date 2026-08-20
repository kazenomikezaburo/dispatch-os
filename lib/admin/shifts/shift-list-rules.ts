import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/dashboard/dashboard-rules";
import type {
  ShiftListItem,
  ShiftPeriod,
  ShiftQuery,
  StaffingState,
} from "./shift-list-types";

export { ACTIVE_ASSIGNMENT_STATUSES };
export const ACTIVE_APPLICATION_STATUSES = ["applied", "accepted"] as const;

export type ShiftListInput = Omit<
  ShiftListItem,
  "applicationCount" | "assignedWorkers" | "shortage" | "staffingState"
>;

export function getStaffingState(
  requiredWorkers: number,
  assignedWorkers: number,
): StaffingState {
  if (assignedWorkers === 0) return "unassigned";
  return assignedWorkers < Math.max(requiredWorkers, 1) ? "shortage" : "filled";
}

export function buildShiftList(
  shifts: ShiftListInput[],
  applicationShiftIds: string[],
  assignmentShiftIds: string[],
  query: ShiftQuery,
) {
  const applicationCounts = countByShift(applicationShiftIds);
  const assignmentCounts = countByShift(assignmentShiftIds);
  const needle = query.q.toLocaleLowerCase("ja");

  return shifts
    .map((shift): ShiftListItem => {
      const assignedWorkers = assignmentCounts.get(shift.id) ?? 0;
      const shortage = Math.max(shift.requiredWorkers - assignedWorkers, 0);
      return {
        ...shift,
        applicationCount: applicationCounts.get(shift.id) ?? 0,
        assignedWorkers,
        shortage,
        staffingState: getStaffingState(shift.requiredWorkers, assignedWorkers),
      };
    })
    .filter((shift) =>
      !needle || [shift.projectName, shift.jobName, shift.workplaceName]
        .some((value) => value.toLocaleLowerCase("ja").includes(needle)),
    )
    .filter((shift) => query.staffing === "all" || shift.staffingState === query.staffing)
    .sort((left, right) => compareShifts(left, right, query.period));
}

function countByShift(ids: string[]) {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

function compareShifts(left: ShiftListItem, right: ShiftListItem, period: ShiftPeriod) {
  const timeDifference = period === "past"
    ? right.startsAt.localeCompare(left.startsAt)
    : left.startsAt.localeCompare(right.startsAt);
  if (timeDifference !== 0) return timeDifference;
  const staffingRank = { unassigned: 0, shortage: 0, filled: 1 } as const;
  return staffingRank[left.staffingState] - staffingRank[right.staffingState]
    || left.projectName.localeCompare(right.projectName, "ja")
    || left.jobName.localeCompare(right.jobName, "ja")
    || left.id.localeCompare(right.id);
}

export function getTokyoPeriodRange(period: ShiftPeriod, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const offset = 9 * 60 * 60 * 1000;
  const instant = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d) - offset).toISOString();
  const today = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (today.getUTCDay() + 6) % 7;

  switch (period) {
    case "today": return { start: instant(year, month, day), end: instant(year, month, day + 1) };
    case "tomorrow": return { start: instant(year, month, day + 1), end: instant(year, month, day + 2) };
    case "this_week": return { start: instant(year, month, day - mondayOffset), end: instant(year, month, day - mondayOffset + 7) };
    case "this_month": return { start: instant(year, month, 1), end: instant(year, month + 1, 1) };
    case "upcoming": return { start: instant(year, month, day) };
    case "past": return { end: instant(year, month, day) };
    case "all": return {};
  }
}
