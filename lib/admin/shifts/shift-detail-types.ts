import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";
import type { StaffingState } from "./shift-list-types";
import type { PreShiftConfirmationSummary } from "./pre-shift-confirmation-types";

export type ApplicationStatus = "applied" | "accepted" | "rejected" | "withdrawn";
export type AssignmentStatus = "assigned" | "confirmed" | "cancelled_by_worker" | "cancelled_by_company" | "absent" | "no_show" | "completed";

export type ShiftDetailApplication = {
  id: string;
  workerId: string;
  workerName: string;
  status: ApplicationStatus;
  appliedAt: string;
  assigned: boolean;
};

export type ShiftDetailAssignment = {
  id: string;
  workerId: string;
  workerName: string;
  status: AssignmentStatus;
  startWorkAt?: string | null;
};

export type AdminShiftDetail = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: ShiftStatus;
  requiredWorkers: number;
  breakMinutes: number | null;
  applicationDeadline: string | null;
  project: { id: string; name: string };
  job: {
    id: string;
    name: string;
    description: string | null;
    hourlyWage: number | null;
    transportationFeeCap: number | null;
    dressCode: string | null;
    requirements: string | null;
    mealNotes: string | null;
    recruitmentNotes: string | null;
    manualUrl: string | null;
  };
  workplace: { id: string; name: string };
  applicationCount: number;
  assignedWorkers: number;
  shortage: number;
  staffingState: StaffingState;
  applications: ShiftDetailApplication[];
  assignments: ShiftDetailAssignment[];
  preShiftConfirmations: PreShiftConfirmationSummary;
};

export type ShiftDetailResult =
  | { ok: true; detail: AdminShiftDetail }
  | { ok: false; reason: "not_found" | "error" };
