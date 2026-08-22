import type { AssignmentStatus } from "./shift-detail-types";
import type { PreShiftConfirmationState } from "../../domain/pre-shift-confirmation";

export type { PreShiftConfirmationState } from "../../domain/pre-shift-confirmation";

export type PreShiftConfirmationItem = {
  assignmentId: string;
  workerName: string;
  assignmentStatus: AssignmentStatus;
  state: PreShiftConfirmationState;
  submittedAt: string | null;
};

export type PreShiftConfirmationSummary = {
  confirmedCount: number;
  unconfirmedCount: number;
  beforeOpenCount: number;
  items: PreShiftConfirmationItem[];
};
