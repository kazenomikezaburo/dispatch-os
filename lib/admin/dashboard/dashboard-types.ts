export type DashboardSeverity = "critical" | "warning";

type WorkerAlertBase = {
  id: string;
  severity: DashboardSeverity;
  workerId: string;
  workerName: string;
  assignmentId: string;
  shiftSlotId: string;
  startsAt: string;
  projectName: string;
  workplaceName: string;
};

export type AttendanceMissingAlert = WorkerAlertBase & {
  type: "attendance_missing";
  severity: "critical";
  title: "勤務開始報告がありません";
  description: string;
  href: "/admin/attendance";
};

export type PreShiftMissingAlert = WorkerAlertBase & {
  type: "pre_shift_missing";
  severity: "warning";
  title: "前日確認が提出されていません";
  description: string;
  href: "/admin/shifts";
};

export type StaffingShortageAlert = {
  id: string;
  type: "staffing_shortage";
  severity: "critical";
  title: "人員が不足しています";
  description: string;
  href: "/admin/shifts";
  shiftSlotId: string;
  startsAt: string;
  projectName: string;
  workplaceName: string;
  requiredWorkers: number;
  assignedWorkers: number;
  shortage: number;
};

export type DashboardAlert =
  | AttendanceMissingAlert
  | PreShiftMissingAlert
  | StaffingShortageAlert;

export type DashboardWorkplace = {
  id: string;
  jobId: string;
  projectName: string;
  workplaceName: string;
  startsAt: string;
  endsAt: string;
  requiredWorkers: number;
  assignedWorkers: number;
  shortage: number;
  progress: number;
  status: "normal" | "attention";
  hasWorkerAlert: boolean;
  href: "/admin/shifts";
};

export type DashboardData = {
  summary: {
    activeWorkers: number;
    normalWorkers: number;
    alertCount: number;
  };
  alerts: DashboardAlert[];
  workplaces: DashboardWorkplace[];
};

export type DashboardShiftInput = {
  id: string;
  jobId: string;
  startsAt: string;
  endsAt: string;
  requiredWorkers: number;
  projectName: string;
  workplaceName: string;
};

export type DashboardAssignmentInput = {
  id: string;
  shiftSlotId: string;
  workerId: string;
  workerName: string;
  status: string;
};

export type DashboardRuleInput = {
  now: Date;
  shifts: DashboardShiftInput[];
  assignments: DashboardAssignmentInput[];
  startWorkAssignmentIds: Set<string>;
  confirmedAssignmentIds: Set<string>;
};

export type DashboardDataResult =
  | { ok: true; data: DashboardData }
  | { ok: false };
