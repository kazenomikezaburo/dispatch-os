import Link from "next/link";
import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import { SHIFT_STATUSES } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftQuery } from "@/lib/admin/shifts/shift-list-types";
import { shiftViewHref, type ShiftViewState } from "@/lib/admin/shifts/shift-view-rules";
import { adminStateActionClass } from "@/components/admin/admin-state";

const PERIODS = { today: "今日", tomorrow: "明日", this_week: "今週", this_month: "今月", upcoming: "今後", past: "過去", all: "すべて" } as const;
const STAFFING = { all: "すべて", unassigned: "未配置", shortage: "不足あり", filled: "配置完了" } as const;
const control = "mt-1.5 min-h-11 min-w-0 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function ShiftFilters({ query, state }: { query: ShiftQuery; state: ShiftViewState }) {
  const rangeView = state.view !== "list" || !!state.date;
  const reset = shiftViewHref({ q: "", period: "upcoming", status: "all", staffing: "all" }, state);
  return <form key={`${state.view}-${state.date}-${state.month}-${query.q}-${query.period}-${query.status}-${query.staffing}`} method="get" className="rounded-panel border border-border bg-surface p-4">
    <input type="hidden" name="view" value={state.view} />
    {state.view === "calendar" ? <input type="hidden" name="month" value={state.month} /> : state.date && <input type="hidden" name="date" value={state.date} />}
    {rangeView && <input type="hidden" name="period" value={query.period} />}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="min-w-0 text-sm font-medium text-foreground-secondary">検索<input name="q" type="search" defaultValue={query.q} maxLength={100} placeholder="案件・業務・勤務先" className={control} /></label>
      {rangeView ? <div className="text-sm text-foreground-secondary"><p className="font-medium">期間</p><p className="mt-3">{state.view === "week" ? "表示中の週" : state.view === "calendar" ? "表示中の月" : state.date}</p><p className="mt-1 text-xs text-foreground-muted">日付指定を優先しています</p></div> : <label className="text-sm font-medium text-foreground-secondary">期間<select name="period" defaultValue={query.period} className={control}>{Object.entries(PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label className="text-sm font-medium text-foreground-secondary">シフト状態<select name="status" defaultValue={query.status} className={control}><option value="all">すべて</option>{SHIFT_STATUSES.map((status) => <option key={status} value={status}>{SHIFT_STATUS_LABELS[status]}</option>)}</select></label>
      <label className="text-sm font-medium text-foreground-secondary">人員状態<select name="staffing" defaultValue={query.staffing} className={control}>{Object.entries(STAFFING).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div><div className="mt-4 flex flex-wrap justify-end gap-3"><Link href={reset} className={adminStateActionClass}>条件をリセット</Link><button type="submit" className="min-h-11 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">検索</button></div>
  </form>;
}
