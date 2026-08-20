import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";

export const SHIFT_PERIODS = ["today", "tomorrow", "this_week", "this_month", "upcoming", "past", "all"] as const;
export const STAFFING_FILTERS = ["all", "unassigned", "shortage", "filled"] as const;

export type ShiftPeriod = (typeof SHIFT_PERIODS)[number];
export type StaffingFilter = (typeof STAFFING_FILTERS)[number];
export type StaffingState = Exclude<StaffingFilter, "all">;
export type ShiftStatusFilter = "all" | ShiftStatus;

export type ShiftQuery = {
  q: string;
  period: ShiftPeriod;
  status: ShiftStatusFilter;
  staffing: StaffingFilter;
};

export type ShiftListItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  projectName: string;
  jobName: string;
  workplaceName: string;
  requiredWorkers: number;
  applicationCount: number;
  assignedWorkers: number;
  shortage: number;
  status: ShiftStatus;
  staffingState: StaffingState;
};

export type ShiftListResult =
  | { ok: true; shifts: ShiftListItem[] }
  | { ok: false };
