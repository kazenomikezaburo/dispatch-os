import { CalendarDays } from "lucide-react";
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
    <li className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <article aria-labelledby={`project-${project.id}`} className="grid gap-5 xl:grid-cols-[minmax(16rem,1.4fr)_minmax(11rem,.8fr)_minmax(16rem,1fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 xl:block">
            <h2 id={`project-${project.id}`} className="text-base font-semibold text-slate-950 sm:text-lg">{project.name}</h2>
            <div className="xl:mt-3"><ProjectStatusBadge status={project.status} /></div>
          </div>
          <p className="mt-1 text-sm text-slate-600">{project.clientName}</p>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            <span>{formatDate(project.startDate)} ～ {formatDate(project.endDate)}</span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-slate-500">業務・勤務先</dt><dd className="mt-1 font-semibold text-slate-950">{project.jobCount}件</dd></div>
          <div><dt className="text-slate-500">シフト</dt><dd className="mt-1 font-semibold text-slate-950">{project.shiftCount}件</dd></div>
          <div><dt className="text-slate-500">必要</dt><dd className="mt-1 font-semibold text-slate-950">{project.requiredWorkers}名</dd></div>
          <div><dt className="text-slate-500">配置</dt><dd className="mt-1 font-semibold text-slate-950">{project.assignedWorkers}名</dd></div>
          <div><dt className="text-slate-500">不足</dt><dd className={`mt-1 font-semibold ${project.shortage > 0 ? "text-red-700" : "text-slate-950"}`}>{project.shortage}名</dd></div>
        </dl>
        <div>
          <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-800">配置率</span><span className="font-semibold text-slate-950">{project.assignedWorkers} / {project.requiredWorkers}名（{project.progress}%）</span></div>
          <div role="progressbar" aria-label={`${project.name}の配置率`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressWidth} className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full ${project.shortage > 0 ? "bg-amber-500" : "bg-blue-700"}`} style={{ width: `${progressWidth}%` }} />
          </div>
          <p className={`mt-3 inline-flex rounded px-2.5 py-1 text-xs font-semibold ${project.shortage > 0 ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
            {project.shortage > 0 ? `${project.shortage}名不足` : "配置充足"}
          </p>
          <div className="mt-3 text-right">
            <Link href={`/admin/projects/${project.id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              詳細を見る<span aria-hidden="true">›</span>
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}
