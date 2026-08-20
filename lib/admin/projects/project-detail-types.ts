import type { ProjectListItem, ProjectStatus } from "./project-types";

export type JobStatus = "draft" | "recruiting" | "closed" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type ShiftStatus = JobStatus;

export type ProjectDetailShift = {
  id: string;
  label: string | null;
  startsAt: string;
  endsAt: string;
  status: ShiftStatus;
  requiredWorkers: number;
  assignedWorkers: number;
  shortage: number;
};

export type ProjectDetailJob = {
  id: string;
  name: string;
  status: JobStatus;
  workplace: { id: string; name: string; address: string };
  shiftCount: number;
  requiredWorkers: number;
  assignedWorkers: number;
  shortage: number;
  shifts: ProjectDetailShift[];
};

export type ProjectDetail = {
  id: string;
  name: string;
  branchId: string;
  clientName: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  description: string | null;
  summary: ProjectListItem;
  jobs: ProjectDetailJob[];
};

export type ProjectDetailResult =
  | { ok: true; detail: ProjectDetail }
  | { ok: false; reason: "not_found" | "error" };
