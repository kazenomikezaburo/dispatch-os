import type { ShiftListItem } from "@/lib/admin/shifts/shift-list-types";

export function ShiftSummary({ shifts, scope }: { shifts: ShiftListItem[]; scope: string }) {
  const metrics = [
    ["対象シフト", shifts.length, "件"],
    ["必要人数", shifts.reduce((n, row) => n + row.requiredWorkers, 0), "名"],
    ["配置人数", shifts.reduce((n, row) => n + row.assignedWorkers, 0), "名"],
    ["不足人数", shifts.reduce((n, row) => n + row.shortage, 0), "名"],
  ] as const;
  return <section aria-label={`検索結果の集計（${scope}）`}><p className="mb-2 text-xs text-foreground-muted">集計対象：{scope}・現在の検索条件</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {metrics.map(([label, value, unit]) => <div key={label} className="rounded-panel border border-border bg-surface p-4"><p className="text-xs text-foreground-muted">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}<span className="ml-1 text-sm font-normal">{unit}</span></p></div>)}
  </div></section>;
}
