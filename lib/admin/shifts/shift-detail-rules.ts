import {
  ACTIVE_APPLICATION_STATUSES,
  getStaffingState,
} from "./shift-list-rules";
import type {
  AdminShiftDetail,
  ApplicationStatus,
  ShiftDetailApplication,
  ShiftDetailAssignment,
} from "./shift-detail-types";

const activeApplicationSet = new Set<string>(ACTIVE_APPLICATION_STATUSES);
const applicationRank: Record<ApplicationStatus, number> = {
  applied: 0,
  accepted: 1,
  rejected: 2,
  withdrawn: 2,
};

type DetailBase = Omit<
  AdminShiftDetail,
  "applicationCount" | "assignedWorkers" | "shortage" | "staffingState" | "applications" | "assignments" | "preShiftConfirmations" | "editRestrictions"
>;

export function buildShiftDetail(
  base: DetailBase,
  applications: Omit<ShiftDetailApplication, "assigned">[],
  assignments: ShiftDetailAssignment[],
): Omit<AdminShiftDetail, "preShiftConfirmations" | "editRestrictions"> {
  const activeAssignments = assignments.filter((item) =>
    item.status === "assigned" || item.status === "confirmed" || item.status === "completed");
  const assignedWorkerIds = new Set(activeAssignments.map((item) => item.workerId));
  const sortedApplications = applications
    .map((item) => ({ ...item, assigned: assignedWorkerIds.has(item.workerId) }))
    .sort((left, right) => applicationRank[left.status] - applicationRank[right.status]
      || left.appliedAt.localeCompare(right.appliedAt)
      || left.id.localeCompare(right.id));
  const sortedAssignments = [...assignments].sort((left, right) =>
    left.workerName.localeCompare(right.workerName, "ja") || left.id.localeCompare(right.id));
  const applicationCount = sortedApplications.filter((item) => activeApplicationSet.has(item.status)).length;
  const assignedWorkers = activeAssignments.length;
  const shortage = Math.max(base.requiredWorkers - assignedWorkers, 0);
  return {
    ...base,
    applicationCount,
    assignedWorkers,
    shortage,
    staffingState: getStaffingState(base.requiredWorkers, assignedWorkers),
    applications: sortedApplications,
    assignments: sortedAssignments,
  };
}

export function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
