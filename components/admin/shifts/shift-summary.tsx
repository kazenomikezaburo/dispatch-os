import type { ShiftListItem } from "@/lib/admin/shifts/shift-list-types";
import { AdminKpiCard, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

export function ShiftSummary({ shifts, scope }: { shifts: ShiftListItem[]; scope: string }) {
  const metrics = [
    ["対象シフト", shifts.length, "件", "neutral"],
    ["必要人数", shifts.reduce((n, row) => n + row.requiredWorkers, 0), "名", "info"],
    ["配置人数", shifts.reduce((n, row) => n + row.assignedWorkers, 0), "名", "success"],
    ["不足人数", shifts.reduce((n, row) => n + row.shortage, 0), "名", "warning"],
  ] as const;
  return <section aria-label={`検索結果の集計（${scope}）`}><p className="mb-2 text-xs text-foreground-muted">集計対象：{scope}・現在の検索条件</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {metrics.map(([label, value, unit, tone]) => <AdminKpiCard key={label} label={label} value={value} unit={unit} tone={tone as AdminVisualTone} />)}
  </div></section>;
}
