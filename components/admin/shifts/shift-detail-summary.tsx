import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";
export function ShiftDetailSummary({ detail }: { detail: AdminShiftDetail }) {
  const metrics = [["必要人数", detail.requiredWorkers], ["配置済み", detail.assignedWorkers], ["応募", detail.applicationCount], ["不足", detail.shortage]] as const;
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-panel border border-border bg-surface p-4"><dt className="text-xs text-foreground-muted">{label}</dt><dd className={`mt-2 text-2xl font-semibold ${label === "不足" && value > 0 ? "text-warning" : label === "配置済み" ? "text-success" : "text-foreground"}`}>{value}<span className="ml-1 text-sm font-normal text-foreground-muted">名</span></dd></div>)}</dl>;
}
