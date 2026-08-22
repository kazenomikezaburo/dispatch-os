import type { PreShiftConfirmationState } from "@/lib/domain/pre-shift-confirmation";
import type { HealthStatus } from "./pre-shift-confirmation-schema";
import type { WorkerAttendanceState } from "@/lib/domain/worker-attendance";

export type WorkerConfirmation = {
  canWork: boolean;
  healthStatus: HealthStatus;
  submittedAt: string;
};

export type WorkerAssignment = {
  id: string;
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
};

export type WorkerAssignmentResult =
  | { ok: true; assignment: WorkerAssignment }
  | { ok: false; reason: "not_found" | "error" };
