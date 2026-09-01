import { buildProjectList, type JobInput, type ProjectInput } from "./project-rules";
import type { JobStatus, ProjectDetail, ProjectDetailJob, ProjectDetailShift, ShiftStatus } from "./project-detail-types";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "下書き", recruiting: "募集中", closed: "募集終了",
  confirmed: "確定", in_progress: "進行中", completed: "完了", cancelled: "中止",
};
export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = JOB_STATUS_LABELS;

export type DetailProjectInput = ProjectInput & { branchId: string; clientId: string; description: string | null; updatedAt: string };
export type DetailJobInput = {
  id: string; projectId: string; name: string; status: JobStatus;
  description: string | null;
  workplace: { id: string; name: string; address: string };
  hourlyWage: number | null;
  transportationFeeCap: number | null;
  dressCode: string | null; requirements: string | null; mealNotes: string | null;
  recruitmentNotes: string | null; manualUrl: string | null; updatedAt: string;
  shifts: { id: string; label: string | null; startsAt: string; endsAt: string; status: ShiftStatus; requiredWorkers: number }[];
};

export function buildProjectDetail(project: DetailProjectInput, jobs: DetailJobInput[], activeAssignmentShiftIds: string[]): ProjectDetail {
  const assignmentCounts = new Map<string, number>();
  for (const id of activeAssignmentShiftIds) assignmentCounts.set(id, (assignmentCounts.get(id) ?? 0) + 1);

  const detailJobs: ProjectDetailJob[] = jobs.map((job) => {
    const shifts: ProjectDetailShift[] = job.shifts.map((shift) => {
      const assignedWorkers = assignmentCounts.get(shift.id) ?? 0;
      return { ...shift, assignedWorkers, shortage: Math.max(shift.requiredWorkers - assignedWorkers, 0) };
    }).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.endsAt.localeCompare(b.endsAt) || a.id.localeCompare(b.id));
    const requiredWorkers = shifts.reduce((sum, shift) => sum + shift.requiredWorkers, 0);
    const assignedWorkers = shifts.reduce((sum, shift) => sum + shift.assignedWorkers, 0);
    return { id: job.id, name: job.name, status: job.status, description: job.description, workplace: job.workplace, hourlyWage: job.hourlyWage, transportationFeeCap: job.transportationFeeCap, dressCode: job.dressCode, requirements: job.requirements, mealNotes: job.mealNotes, recruitmentNotes: job.recruitmentNotes, manualUrl: job.manualUrl, updatedAt: job.updatedAt, canEditWorkplace: shifts.length === 0, canEditCompensation: assignedWorkers === 0, shifts, shiftCount: shifts.length, requiredWorkers, assignedWorkers, shortage: Math.max(requiredWorkers - assignedWorkers, 0) };
  }).sort((a, b) => (a.shifts[0]?.startsAt ?? "9999").localeCompare(b.shifts[0]?.startsAt ?? "9999") || a.workplace.name.localeCompare(b.workplace.name, "ja") || a.name.localeCompare(b.name, "ja") || a.id.localeCompare(b.id));

  const listJobs: JobInput[] = jobs.map((job) => ({ id: job.id, projectId: job.projectId, shifts: job.shifts.map((shift) => ({ id: shift.id, requiredWorkers: shift.requiredWorkers })) }));
  const [summary] = buildProjectList([project], listJobs, activeAssignmentShiftIds);
  return { id: project.id, name: project.name, branchId: project.branchId, clientId: project.clientId, clientName: project.clientName, status: project.status, startDate: project.startDate, endDate: project.endDate, description: project.description, updatedAt: project.updatedAt, summary, jobs: detailJobs };
}
