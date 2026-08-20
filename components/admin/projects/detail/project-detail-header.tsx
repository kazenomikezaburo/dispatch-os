import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { ProjectStatusBadge } from "../project-status-badge";
import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";

const date = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const formatDate = (value: string) => date.format(new Date(`${value}T00:00:00+09:00`));

export function ProjectDetailHeader({ project }: { project: ProjectDetail }) {
  return <header className="space-y-4">
    <AdminBreadcrumb items={[{ label: "案件管理" }, { label: project.name }]} />
    <Link href="/admin/projects" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><ArrowLeft aria-hidden="true" className="size-4" />案件一覧へ戻る</Link>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{project.name}</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">{project.clientName}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><CalendarDays aria-hidden="true" className="size-4" />{formatDate(project.startDate)} ～ {formatDate(project.endDate)}</p></div><ProjectStatusBadge status={project.status} /></div>
  </header>;
}
