import type { ShiftDetailAssignment } from "./shift-detail-types";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { getPreShiftConfirmationState } from "../../domain/pre-shift-confirmation.ts";
import type {
  PreShiftConfirmationItem,
  PreShiftConfirmationState,
  PreShiftConfirmationSummary,
} from "./pre-shift-confirmation-types";

type ConfirmationInput = { assignmentId: string; submittedAt: string };

const stateRank: Record<PreShiftConfirmationState, number> = {
  pending: 0,
  not_open: 1,
  confirmed: 2,
};

export function buildPreShiftConfirmationSummary(
  startsAt: string,
  assignments: ShiftDetailAssignment[],
  confirmations: ConfirmationInput[],
  now: Date,
): PreShiftConfirmationSummary {
  const confirmationByAssignment = new Map(
    confirmations.map((item) => [item.assignmentId, item]),
  );
  const items = assignments.map((assignment): PreShiftConfirmationItem => {
    const confirmation = confirmationByAssignment.get(assignment.id);
    const state = getPreShiftConfirmationState({
      startsAt,
      hasConfirmation: Boolean(confirmation),
      now,
    });
    return {
      assignmentId: assignment.id,
      workerName: assignment.workerName,
      assignmentStatus: assignment.status,
      state,
      submittedAt: confirmation?.submittedAt ?? null,
    };
  }).sort((left, right) =>
    stateRank[left.state] - stateRank[right.state]
    || left.workerName.localeCompare(right.workerName, "ja")
    || left.assignmentId.localeCompare(right.assignmentId));

  return {
    confirmedCount: items.filter((item) => item.state === "confirmed").length,
    unconfirmedCount: items.filter((item) => item.state === "pending").length,
    beforeOpenCount: items.filter((item) => item.state === "not_open").length,
    items,
  };
}
