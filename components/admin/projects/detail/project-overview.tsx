import { PROJECT_STATUS_LABELS } from "@/lib/admin/projects/project-rules";
import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";

export function ProjectOverview({ project }: { project: ProjectDetail }) {
  return <section aria-labelledby="overview-title" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><h2 id="overview-title" className="text-lg font-semibold text-slate-950">案件概要</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">取引先</dt><dd className="mt-1 text-sm font-medium text-slate-950">{project.clientName}</dd></div><div><dt className="text-sm text-slate-500">状態</dt><dd className="mt-1 text-sm font-medium text-slate-950">{PROJECT_STATUS_LABELS[project.status]}</dd></div><div className="sm:col-span-2"><dt className="text-sm text-slate-500">説明</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{project.description || "未設定"}</dd></div></dl></section>;
}
