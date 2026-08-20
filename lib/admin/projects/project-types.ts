export const PROJECT_STATUSES = [
  "draft",
  "recruiting",
  "closed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPeriod = "all" | "upcoming" | "this_month" | "past";

export type ProjectQuery = {
  q: string;
  status: "all" | ProjectStatus;
  period: ProjectPeriod;
};

export type ProjectListItem = {
  id: string;
  name: string;
  clientName: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  jobCount: number;
  shiftCount: number;
  requiredWorkers: number;
  assignedWorkers: number;
  shortage: number;
  progress: number;
};

export type ProjectsResult =
  | { ok: true; projects: ProjectListItem[] }
  | { ok: false };
