import Link from "next/link";
import { shiftDate } from "@/lib/admin/attendance/attendance-query-schema";
import type { AttendanceQuery } from "@/lib/admin/attendance/attendance-types";

const field = "mt-1.5 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-focus-ring";
export function attendanceHref(query: AttendanceQuery, changes: Partial<AttendanceQuery>) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams({ date: next.date, state: next.state, confirmation: next.confirmation, attention: next.attention, page: String(next.page) });
  if (next.q) params.set("q", next.q);
  return `/admin/attendance?${params}`;
}
export function AttendanceFilters({ query, today }: { query: AttendanceQuery; today: string }) {
  return (
    <section aria-label="勤怠の表示条件" className="rounded-panel border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center rounded-control border border-border-strong px-4 text-sm font-medium hover:bg-surface-hover" href={attendanceHref(query, { date: shiftDate(query.date, -1), page: 1 })}>前日</Link>
        <Link className="inline-flex min-h-11 items-center rounded-control border border-border-strong px-4 text-sm font-medium hover:bg-surface-hover" href={attendanceHref(query, { date: today, page: 1 })}>今日</Link>
        <Link className="inline-flex min-h-11 items-center rounded-control border border-border-strong px-4 text-sm font-medium hover:bg-surface-hover" href={attendanceHref(query, { date: shiftDate(query.date, 1), page: 1 })}>翌日</Link>
      </div>
      <form method="get" className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium">日付<input type="date" name="date" defaultValue={query.date} className={field} /></label>
        <label className="text-sm font-medium">勤務状態<select name="state" defaultValue={query.state} className={field}><option value="all">すべて</option><option value="scheduled">勤務前</option><option value="start_missing">開始未報告</option><option value="working">勤務中</option><option value="finished">勤務終了</option><option value="absent">欠勤</option><option value="no_show">無断欠勤</option></select></label>
        <label className="text-sm font-medium">確認状態<select name="confirmation" defaultValue={query.confirmation} className={field}><option value="all">すべて</option><option value="unconfirmed">未確定</option><option value="confirmed">確定</option><option value="corrected">訂正済み</option></select></label>
        <label className="text-sm font-medium">確認対象<select name="attention" defaultValue={query.attention} className={field}><option value="all">すべて</option><option value="needs_attention">要確認のみ</option></select></label>
        <label className="text-sm font-medium">検索<input name="q" defaultValue={query.q} maxLength={100} placeholder="スタッフ・案件・業務・勤務先" className={field} /></label>
        <input type="hidden" name="page" value="1" />
        <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-5 xl:justify-end">
          <Link href={`/admin/attendance?date=${query.date}`} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-link hover:text-link-hover">条件をリセット</Link>
          <button className="min-h-11 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">表示する</button>
        </div>
      </form>
    </section>
  );
}
