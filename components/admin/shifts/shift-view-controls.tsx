import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { adminStateActionClass } from "@/components/admin/admin-state";
import type { ShiftQuery } from "@/lib/admin/shifts/shift-list-types";
import { addDays, adjacentMonth, isShiftDate, shiftDayLabel, shiftViewHref, weekDays, type ShiftViewState } from "@/lib/admin/shifts/shift-view-rules";

export function ShiftViewControls({ query, state }: { query: ShiftQuery; state: ShiftViewState }) {
  const week = state.view === "week";
  const days = weekDays(state.date || state.today);
  const previous = week ? addDays(state.date, -7) : `${adjacentMonth(state.month, -1)}-01`;
  const next = week ? addDays(state.date, 7) : `${adjacentMonth(state.month, 1)}-01`;
  const href = (date: string) => shiftViewHref(query, state, week ? { date } : { month: date.slice(0, 7) });
  return <div className="space-y-4">
    <nav aria-label="シフトの表示形式" className="flex w-fit max-w-full rounded-control border border-border bg-surface p-1">
      {([ ["list", "一覧"], ["week", "週"], ["calendar", "カレンダー"] ] as const).map(([view, label]) => <Link key={view} href={shiftViewHref(query, state, { view })} aria-current={state.view === view ? "page" : undefined} className={`inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${state.view === view ? "bg-primary text-primary-foreground" : "text-foreground-secondary hover:bg-surface-hover"}`}>{label}</Link>)}
    </nav>
    {state.view !== "list" ? <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold tabular-nums">{week ? `${days[0].slice(0, 4)}年 ${shiftDayLabel(days[0])} – ${days[6].slice(0, 4) !== days[0].slice(0, 4) ? `${days[6].slice(0, 4)}年 ` : ""}${shiftDayLabel(days[6])}` : `${state.month.slice(0, 4)}年${Number(state.month.slice(5))}月`}</h2>
      <nav aria-label={week ? "週を移動" : "月を移動"} className="flex gap-2">
        {isShiftDate(previous) && <Link href={href(previous)} aria-label={week ? "前の週" : "前の月"} className={adminStateActionClass}><ChevronLeft className="size-4" aria-hidden="true" /></Link>}
        <Link href={href(state.today)} className={adminStateActionClass}>今日</Link>
        {isShiftDate(next) && <Link href={href(next)} aria-label={week ? "次の週" : "次の月"} className={adminStateActionClass}><ChevronRight className="size-4" aria-hidden="true" /></Link>}
      </nav>
    </div> : state.date && <p className="flex flex-wrap items-center gap-3 text-sm">勤務日：{state.date}（{shiftDayLabel(state.date)}）<Link href={shiftViewHref(query, state, { date: "" })} className={adminStateActionClass}>日付指定を解除</Link></p>}
  </div>;
}
