import Link from "next/link";
import type { ProjectListItem as ProjectListItemType } from "@/lib/admin/projects/project-types";
import { ProjectStatusBadge } from "./project-status-badge";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00+09:00`));
}

export function ProjectListItem({ project }: { project: ProjectListItemType }) {
  const progressWidth = Math.min(Math.max(project.progress, 0), 100);
  return (
    <li className="p-4 sm:p-5">
      <article aria-labelledby={`project-${project.id}`} className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_3rem_6rem_minmax(0,1fr)_5rem] lg:items-center">
        <div className="min-w-0">
          <h3 id={`project-${project.id}`} className="text-sm font-semibold">
            <Link href={`/admin/projects/${project.id}`} className="inline-flex min-h-11 items-center text-blue-700 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ">
              {project.name}
            </Link>
          </h3>
          <p className="text-xs text-slate-500">{project.clientName} / 業務・勤務先 {project.jobCount}件</p>
        </div>
        <div><p className="text-xs font-medium text-slate-500 lg:hidden">期間</p><p className="mt-1 text-sm text-slate-800 lg:mt-0 lg:break-words">{formatDate(project.startDate)}〜{formatDate(project.endDate)}</p></div>
        <div><p className="text-xs font-medium text-slate-500 lg:hidden">シフト</p><p className="mt-1 text-sm font-medium text-slate-900 lg:mt-0">{project.shiftCount}件</p></div>
        <div>
          <p className="text-xs font-medium text-slate-500 lg:hidden">必要 / 配置</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 lg:mt-0">{project.requiredWorkers} / {project.assignedWorkers}名</p>
          {project.shortage > 0 && <p className="mt-1 text-xs font-semibold text-red-700">{project.shortage}名不足</p>}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-500 lg:sr-only">充足率</span><span className="text-xs font-medium text-slate-600">{project.progress}%</span></div>
          <div role="progressbar" aria-label={`${project.name}の配置率 ${project.progress}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressWidth} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full ${project.shortage > 0 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${progressWidth}%` }} />
          </div>
        </div>
        <div className="flex items-center lg:block"><ProjectStatusBadge status={project.status} /></div>
      </article>
    </li>
  );
}
