import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";

const date = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const formatDate = (value: string) => date.format(new Date(`${value}T00:00:00+09:00`));

export function ProjectOverview({ project }: { project: ProjectDetail }) {
  return <section aria-labelledby="overview-title" className="border-t border-slate-200 pt-6">
    <h2 id="overview-title" className="text-lg font-semibold text-slate-950">案件基本情報</h2>
    <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
      <div><dt className="text-sm text-slate-500">取引先</dt><dd className="mt-1 text-sm font-medium text-slate-950">{project.clientName}</dd></div>
      <div><dt className="text-sm text-slate-500">案件期間</dt><dd className="mt-1 text-sm font-medium text-slate-950">{formatDate(project.startDate)} ～ {formatDate(project.endDate)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-sm text-slate-500">説明</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{project.description || "未設定"}</dd></div>
    </dl>
  </section>;
}
