import { CalendarDays } from "lucide-react";
import Link from "next/link";
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
        <h1 id="page-title" className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{project.name}</h1>
        <p className="mt-2 text-sm font-medium text-slate-700 sm:text-base">{project.clientName}</p>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><CalendarDays aria-hidden="true" className="size-4 shrink-0" />{formatDate(project.startDate)} ～ {formatDate(project.endDate)}</p>
      </div>
      <div className="flex min-h-11 flex-wrap items-center gap-2 sm:max-w-sm sm:justify-end"><ProjectStatusBadge status={project.status} />{project.jobs.length > 0 && <Link href={project.jobs.length === 1 ? `/admin/projects/${project.id}/jobs/${project.jobs[0].id}/shifts/new` : "#project-jobs"} className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">シフトを作成</Link>}{formOptions && <ProjectEditDrawer project={project} options={formOptions} />}</div>
    </div>
  </header>;
}
