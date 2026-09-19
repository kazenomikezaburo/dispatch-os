import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";
import type { ProjectFormInput } from "@/lib/admin/projects/project-form-schema";
import type { ShiftFormValues } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftFormOptions } from "@/lib/admin/projects/shift-form-types";
import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";

const tokyoParts = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
};

export function buildProjectEditInitialValues(project: ProjectDetail): ProjectFormInput {
  return { name: project.name, branch_id: project.branchId, client_id: project.clientId, start_date: project.startDate, end_date: project.endDate, status: project.status, description: project.description ?? "" };
}

export function buildShiftEditModel(detail: AdminShiftDetail): { values: ShiftFormValues; options: ShiftFormOptions } {
  const start = tokyoParts(detail.startsAt);
  const end = tokyoParts(detail.endsAt);
  const deadline = detail.applicationDeadline ? tokyoParts(detail.applicationDeadline) : { date: "", time: "" };
  return {
    values: { start_date: start.date, start_time: start.time, end_date: end.date, end_time: end.time, required_workers: String(detail.requiredWorkers), break_minutes: detail.breakMinutes === null ? "" : String(detail.breakMinutes), deadline_date: deadline.date, deadline_time: deadline.time, status: detail.status },
    options: { project: { id: detail.project.id, name: detail.project.name, status: "recruiting" }, job: { id: detail.job.id, name: detail.job.name, status: "recruiting", workplaceName: detail.workplace.name, hourlyWage: detail.job.hourlyWage, transportationFeeCap: detail.job.transportationFeeCap } },
  };
}
