import type { WorkerAssignment } from "@/lib/worker/worker-assignment-types";
import { compareWorkerPrimaryActions, deriveWorkerAssignmentGroup } from "@/lib/worker/journey/worker-journey";

function isActive(assignment: WorkerAssignment) {
  const group = deriveWorkerAssignmentGroup({ assignmentStatus: assignment.assignmentStatus, shiftStatus: assignment.shiftStatus, startsAt: assignment.startsAt, endsAt: assignment.endsAt, generatedAt: assignment.timeline.generatedAt });
  return group === "current" || group === "upcoming";
}

export function selectWorkerHomeNextAction(assignments: WorkerAssignment[]) {
  return assignments
    .filter((assignment) => isActive(assignment) && assignment.timeline.nextAction?.state !== "not_open")
    .toSorted((a, b) => compareWorkerPrimaryActions(a, b))[0] ?? null;
}

export function selectWorkerHomeNextShift(assignments: WorkerAssignment[]) {
  return assignments.filter(isActive).toSorted((a, b) => {
    const groupA = deriveWorkerAssignmentGroup({ assignmentStatus: a.assignmentStatus, shiftStatus: a.shiftStatus, startsAt: a.startsAt, endsAt: a.endsAt, generatedAt: a.timeline.generatedAt });
    const groupB = deriveWorkerAssignmentGroup({ assignmentStatus: b.assignmentStatus, shiftStatus: b.shiftStatus, startsAt: b.startsAt, endsAt: b.endsAt, generatedAt: b.timeline.generatedAt });
    return Number(groupA === "upcoming") - Number(groupB === "upcoming") || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id);
  })[0] ?? null;
}

export function selectWorkerHomeEndWork(assignments: WorkerAssignment[]) {
  return assignments.filter((assignment) => isActive(assignment) && assignment.canEndWork).toSorted((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))[0] ?? null;
}
