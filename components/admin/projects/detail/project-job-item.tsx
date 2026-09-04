import { MapPin } from "lucide-react";
import Link from "next/link";
import type { ProjectDetail, ProjectDetailJob } from "@/lib/admin/projects/project-detail-types";
import { JOB_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import { JobEditDrawer } from "@/components/admin/projects/jobs/job-edit-drawer";
import type { JobFormOptions } from "@/lib/admin/projects/job-form-types";

const money = new Intl.NumberFormat("ja-JP");

export function ProjectJobItem({ project, job, formOptions }: { project: Pick<ProjectDetail, "id" | "name" | "status">; job: ProjectDetailJob; formOptions?: JobFormOptions }) {
  return <li className={`border-b bg-white px-4 py-5 last:border-b-0 sm:px-5 ${job.shortage > 0 ? "border-amber-200" : "border-slate-200"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-slate-950 sm:text-lg">{job.name}</h3><span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{JOB_STATUS_LABELS[job.status]}</span><span className={`rounded px-2.5 py-1 text-xs font-semibold ${job.shortage > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>{job.shortage > 0 ? `要確認・${job.shortage}名不足` : "配置完了"}</span></div>
          <p className="mt-2 text-sm font-medium text-slate-800">{job.workplace.name}</p>
          <p className="mt-1 flex items-start gap-2 text-sm text-slate-500"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{job.workplace.address}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end"><Link href={`/admin/projects/${project.id}/jobs/${job.id}/shifts/new`} className="inline-flex min-h-11 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-medium text-link hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">シフトを作成</Link>{formOptions && <JobEditDrawer job={job} options={formOptions} />}</div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6"><div><dt className="text-slate-500">シフト</dt><dd className="mt-1 font-semibold text-slate-950">{job.shiftCount}件</dd></div><div><dt className="text-slate-500">必要</dt><dd className="mt-1 font-semibold text-slate-950">{job.requiredWorkers}名</dd></div><div><dt className="text-slate-500">配置</dt><dd className="mt-1 font-semibold text-slate-950">{job.assignedWorkers}名</dd></div><div><dt className="text-slate-500">不足</dt><dd className={`mt-1 font-semibold ${job.shortage > 0 ? "text-red-700" : "text-slate-950"}`}>{job.shortage}名</dd></div><div><dt className="text-slate-500">時給</dt><dd className="mt-1 font-semibold text-slate-950">{job.hourlyWage === null ? "未設定" : `${money.format(job.hourlyWage)}円`}</dd></div><div><dt className="text-slate-500">交通費上限</dt><dd className="mt-1 font-semibold text-slate-950">{job.transportationFeeCap === null ? "未設定" : `${money.format(job.transportationFeeCap)}円`}</dd></div></dl>
  </li>;
}
