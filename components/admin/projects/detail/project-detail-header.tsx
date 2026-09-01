import { CalendarDays } from "lucide-react";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { ProjectStatusBadge } from "../project-status-badge";
import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";
import type { ProjectFormOptions } from "@/lib/admin/projects/project-form-types";
import { ProjectEditDrawer } from "../project-edit-drawer";

const date = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const formatDate = (value: string) => date.format(new Date(`${value}T00:00:00+09:00`));

export function ProjectDetailHeader({ project, formOptions }: { project: ProjectDetail; formOptions?: ProjectFormOptions }) {
  return <header className="space-y-5">
    <AdminBreadcrumb items={[{ label: "案件一覧", href: "/admin/projects" }, { label: project.name }]} />
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{project.name}</h1>
        <p className="mt-2 text-sm font-medium text-slate-700 sm:text-base">{project.clientName}</p>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><CalendarDays aria-hidden="true" className="size-4 shrink-0" />{formatDate(project.startDate)} ～ {formatDate(project.endDate)}</p>
      </div>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2">{formOptions && <ProjectEditDrawer project={project} options={formOptions} />}<ProjectStatusBadge status={project.status} /></div>
    </div>
  </header>;
}
