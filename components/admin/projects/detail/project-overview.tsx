import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";

const date = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const formatDate = (value: string) => date.format(new Date(`${value}T00:00:00+09:00`));

export function ProjectOverview({ project }: { project: ProjectDetail }) {
  return <section aria-labelledby="overview-title">
    <div><h2 id="overview-title" className="text-lg font-semibold text-foreground">案件概要</h2><p className="mt-1 text-sm text-foreground-muted">案件全体の基本情報と管理対象を確認できます。</p></div>
    <dl className="mt-4 grid gap-x-8 gap-y-5 rounded-panel border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5">
      <div><dt className="text-sm text-foreground-muted">取引先</dt><dd className="mt-1 text-sm font-medium text-foreground">{project.clientName}</dd></div>
      <div><dt className="text-sm text-foreground-muted">案件期間</dt><dd className="mt-1 text-sm font-medium text-foreground">{formatDate(project.startDate)} ～ {formatDate(project.endDate)}</dd></div>
      <div><dt className="text-sm text-foreground-muted">業務・勤務先</dt><dd className="mt-1 text-sm font-medium text-foreground">{project.jobs.length}件</dd></div>
      <div><dt className="text-sm text-foreground-muted">シフト</dt><dd className="mt-1 text-sm font-medium text-foreground">{project.summary.shiftCount}件</dd></div>
      <div className="sm:col-span-2"><dt className="text-sm text-foreground-muted">説明</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground-secondary">{project.description || "未設定"}</dd></div>
    </dl>
  </section>;
}
