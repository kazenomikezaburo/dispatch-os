import type { PreShiftConfirmationState } from "@/lib/domain/pre-shift-confirmation";
import type { HealthStatus } from "./pre-shift-confirmation-schema";
import type { WorkerAttendanceState } from "@/lib/domain/worker-attendance";
import type { WorkerOperationalIncident } from "./incidents/worker-incident-ui";

export type WorkerConfirmation = {
  canWork: boolean;
  healthStatus: HealthStatus;
  submittedAt: string;
};

export type WorkerAssignment = {
  id: string;
  assignmentStatus: "assigned" | "confirmed" | "completed" | "cancelled_by_worker" | "cancelled_by_company" | "absent" | "no_show";
  shiftStatus: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number | null;
  projectName: string;
  jobName: string;
  workplaceName: string;
  description: string | null;
  hourlyWage: number | null;
  transportationFeeCap: number | null;
  dressCode: string | null;
  requirements: string | null;
  mealNotes: string | null;
  recruitmentNotes: string | null;
  manualUrl: string | null;
  hasStarted: boolean;
  confirmationState: PreShiftConfirmationState;
  confirmation: WorkerConfirmation | null;
  attendanceState: WorkerAttendanceState;
  startWorkAt: string | null;
  endWorkAt: string | null;
  canStartWork: boolean;
  canEndWork: boolean;
  canCreateIncident: boolean;
  incidents: WorkerOperationalIncident[];
};

export type WorkerAssignmentResult =
  | { ok: true; assignment: WorkerAssignment }
  | { ok: false; reason: "not_found" | "error" };
