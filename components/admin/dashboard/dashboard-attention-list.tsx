import Link from "next/link";
import { DashboardEmptyState } from "./dashboard-empty-state";
import type { AttentionItem } from "@/lib/admin/attention/attention-types";

const typeLabel: Record<AttentionItem["type"], string> = {
  staffing_shortage: "欠員",
  placement_conflict: "Coverage",
  pre_confirmation_overdue: "前日確認",
  day_of_arrival: "当日",
  open_sos: "SOS",
  attendance_needs_review: "勤怠",
};
const toneClass = {
  critical: "bg-danger-subtle text-danger-foreground",
  high: "bg-warning-subtle text-warning-foreground",
  medium: "bg-info-subtle text-info-foreground",
} as const;

export function DashboardAttentionList({ items, total }: { items: AttentionItem[]; total: number }) {
  return <section aria-labelledby="dashboard-attention-title" className="min-w-0">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><h2 id="dashboard-attention-title" className="text-lg font-semibold text-foreground sm:text-xl">対応が必要</h2><span className="inline-flex min-w-9 items-center justify-center rounded-pill bg-danger-subtle px-2.5 py-1 text-xs font-semibold text-danger-foreground">{total}件</span></div><p className="mt-1 text-sm text-foreground-secondary">優先度の高い項目から表示しています。</p></div>
      <Link href="/admin/attention" className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-link hover:bg-surface-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">すべて確認<span aria-hidden="true">›</span></Link>
    </div>
    {items.length === 0 ? <DashboardEmptyState message="現在、対応が必要な項目はありません" /> : <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">{items.map(item=><li key={item.id} className="px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex min-h-7 items-center rounded-pill px-2.5 text-xs font-semibold ${toneClass[item.severity]}`}>{typeLabel[item.type]}</span><span className="text-xs text-foreground-muted">{item.target}</span></div><h3 className="mt-2 text-sm font-semibold text-foreground">{item.title}</h3><p className="mt-1 text-sm text-foreground-secondary">{item.description}</p></div><Link href={item.destination} className="inline-flex min-h-11 shrink-0 items-center justify-center self-start rounded-control px-3 text-sm font-semibold text-link hover:bg-surface-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:self-center">{item.actionLabel}<span aria-hidden="true">›</span></Link></div></li>)}</ul>}
  </section>;
}
