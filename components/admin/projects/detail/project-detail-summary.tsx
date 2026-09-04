import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";
export function ProjectDetailSummary({ project }: { project: ProjectDetail }) {
  const s = project.summary;
  const progress = Math.min(Math.max(s.progress, 0), 100);
  const items = [
    { label: "必要人数", value: `${s.requiredWorkers}名`, tone: "text-foreground" },
    { label: "配置済み", value: `${s.assignedWorkers}名`, tone: "text-success" },
    { label: "不足", value: `${s.shortage}名`, tone: s.shortage > 0 ? "text-warning" : "text-success" },
    { label: "シフト数", value: `${s.shiftCount}件`, tone: "text-link" },
    { label: "配置率", value: `${s.progress}%`, tone: "text-link" },
  ];
  return <section aria-label="配置サマリー"><dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{items.map((item) => <div key={item.label} className="rounded-panel border border-border bg-surface p-4"><dt className="text-xs text-foreground-muted">{item.label}</dt><dd className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</dd>{item.label === "配置率" && <div role="progressbar" aria-label="配置率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-3 h-1.5 overflow-hidden rounded-pill bg-surface-muted"><div className="h-full bg-info" style={{ width: `${progress}%` }} /></div>}</div>)}</dl></section>;
}
