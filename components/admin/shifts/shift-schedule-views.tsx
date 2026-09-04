import Link from "next/link";
import type { ShiftListItem, ShiftQuery } from "@/lib/admin/shifts/shift-list-types";
import { calendarPreview, groupShiftsByDay, isShiftDate, shiftDayLabel, shiftViewDays, shiftViewHref, type ShiftViewState } from "@/lib/admin/shifts/shift-view-rules";
import { ShiftPreviewCard } from "./shift-preview-card";

type Props = { shifts: ShiftListItem[]; state: ShiftViewState; query: ShiftQuery };
const dayLinkClass = "inline-flex min-h-11 min-w-11 items-center gap-2 rounded-control px-2 text-sm font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function ShiftScheduleViews({ shifts, state, query }: Props) {
  const days = shiftViewDays(state);
  const groups = groupShiftsByDay(shifts, days);
  const dayHref = (date: string) => shiftViewHref(query, state, { view: "list", date });
  const today = (date: string) => date === state.today ? <span className="rounded-control bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">今日</span> : null;
  if (state.view === "week") return <section aria-label="週のシフト" className="grid gap-3 lg:grid-cols-7 lg:gap-0 lg:rounded-panel lg:border lg:border-border lg:bg-surface">
    {days.map((day) => <section key={day} aria-label={shiftDayLabel(day)} className={`min-w-0 rounded-panel border border-border p-3 lg:rounded-none lg:border-0 lg:border-r lg:p-2 lg:last:border-r-0 ${day === state.today ? "bg-surface-muted" : "bg-surface"}`}>
      <h3 className="mb-2 flex flex-wrap items-center gap-1 text-sm font-semibold"><span>{shiftDayLabel(day)}</span>{today(day)}</h3>
      <p className="mb-3 text-xs text-foreground-muted">{groups.get(day)!.length}件</p>
      <div className="space-y-2">{groups.get(day)!.map((shift) => <ShiftPreviewCard key={shift.id} shift={shift} />)}</div>
      {!groups.get(day)!.length && <p className="py-5 text-xs text-foreground-muted">シフトなし</p>}
    </section>)}
  </section>;

  return <section aria-label="月のシフト" className="space-y-3">
    <p className="text-xs text-foreground-muted">日付を選ぶとその日の一覧へ移動します。月外の日付は対象月へ移動します。</p>
    <div className="hidden overflow-hidden rounded-panel border border-border bg-surface lg:block">
      <div className="grid grid-cols-7 border-b border-border bg-surface-subtle">{["月", "火", "水", "木", "金", "土", "日"].map((day) => <div key={day} className="p-3 text-center text-xs font-medium text-foreground-muted">{day}</div>)}</div>
      <div className="grid grid-cols-7">{days.map((day) => {
        const inMonth = day.startsWith(state.month);
        const rows = groups.get(day)!;
        const preview = calendarPreview(rows);
        return <section key={day} aria-label={shiftDayLabel(day)} className={`min-h-32 min-w-0 border-r border-b border-border p-2 [&:nth-child(7n)]:border-r-0 ${!inMonth ? "bg-surface-subtle text-foreground-muted" : day === state.today ? "bg-surface-muted" : "bg-surface"}`}>
          <h3>{isShiftDate(day) ? <Link href={inMonth ? dayHref(day) : shiftViewHref(query, state, { month: day.slice(0, 7) })} aria-label={inMonth ? `${day}のシフト一覧` : `${day.slice(0, 7)}へ移動`} className={dayLinkClass}>{inMonth ? Number(day.slice(8)) : `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`}{today(day)}</Link> : <span>{Number(day.slice(8))}</span>}</h3>
          <div className="space-y-2">{preview.visible.map((shift) => <ShiftPreviewCard key={shift.id} shift={shift} compact />)}</div>
          {preview.remaining > 0 && <Link href={dayHref(day)} className={`${dayLinkClass} mt-1 text-link`} aria-label={`${day}の残り${preview.remaining}件を一覧で表示`}>+{preview.remaining}件</Link>}
          {!rows.length && <p className="px-2 py-2 text-xs text-foreground-muted">シフトなし</p>}
        </section>;
      })}</div>
    </div>
    <div className="space-y-3 lg:hidden"><p className="text-sm font-medium">月間予定（日時順）</p>{days.filter((day) => day.startsWith(state.month)).map((day) => <section key={day} aria-label={shiftDayLabel(day)} className={`rounded-panel border border-border p-3 ${day === state.today ? "bg-surface-muted" : "bg-surface"}`}>
      <h3><Link href={dayHref(day)} className={dayLinkClass}>{shiftDayLabel(day)}{today(day)}<span className="text-xs font-normal text-foreground-muted">{groups.get(day)!.length}件</span></Link></h3>
      <div className="space-y-2">{groups.get(day)!.map((shift) => <ShiftPreviewCard key={shift.id} shift={shift} />)}</div>
      {!groups.get(day)!.length && <p className="px-2 pb-2 text-xs text-foreground-muted">シフトなし</p>}
    </section>)}</div>
  </section>;
}
