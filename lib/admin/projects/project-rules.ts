import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/dashboard/dashboard-rules";
import type {
  ProjectListItem,
  ProjectPeriod,
  ProjectStatus,
} from "./project-types";

export { ACTIVE_ASSIGNMENT_STATUSES };

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "下書き",
  recruiting: "募集中",
  closed: "募集終了",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "中止",
};

export const PROJECT_PERIOD_LABELS: Record<ProjectPeriod, string> = {
  all: "すべて",
  upcoming: "今日以降",
  this_month: "今月",
  past: "終了済み",
};

export type ProjectInput = {
  id: string;
  name: string;
  clientName: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
};

export type JobInput = {
  id: string;
  projectId: string;
  shifts: { id: string; requiredWorkers: number }[];
};

export function buildProjectList(
  projects: ProjectInput[],
  jobs: JobInput[],
  activeAssignmentShiftIds: string[],
): ProjectListItem[] {
  const assignmentCounts = new Map<string, number>();
  for (const shiftId of activeAssignmentShiftIds) {
    assignmentCounts.set(shiftId, (assignmentCounts.get(shiftId) ?? 0) + 1);
  }

  const jobsByProject = new Map<string, JobInput[]>();
  for (const job of jobs) {
    const group = jobsByProject.get(job.projectId) ?? [];
    group.push(job);
    jobsByProject.set(job.projectId, group);
  }

  return projects.map((project) => {
    const projectJobs = jobsByProject.get(project.id) ?? [];
    const shifts = projectJobs.flatMap((job) => job.shifts);
    const requiredWorkers = shifts.reduce(
      (total, shift) => total + shift.requiredWorkers,
      0,
    );
    const assignedWorkers = shifts.reduce(
      (total, shift) => total + (assignmentCounts.get(shift.id) ?? 0),
      0,
    );
    const shortage = Math.max(requiredWorkers - assignedWorkers, 0);
    const progress = requiredWorkers === 0
      ? 0
      : Math.round((assignedWorkers / requiredWorkers) * 100);

    return {
      ...project,
      jobCount: projectJobs.length,
      shiftCount: shifts.length,
      requiredWorkers,
      assignedWorkers,
      shortage,
      progress,
    };
  }).sort(compareProjects);
}

function compareProjects(left: ProjectListItem, right: ProjectListItem) {
  const priority: Record<ProjectStatus, number> = {
    in_progress: 0,
    recruiting: 1,
    draft: 2,
    closed: 3,
    completed: 4,
    cancelled: 5,
  };
  return priority[left.status] - priority[right.status]
    || left.startDate.localeCompare(right.startDate)
    || left.name.localeCompare(right.name, "ja")
    || left.id.localeCompare(right.id);
}

export function getTokyoDateRange(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const nextMonthStart = `${nextMonth.year}-${String(nextMonth.month).padStart(2, "0")}-01`;
  return { date, monthStart, nextMonthStart };
}
