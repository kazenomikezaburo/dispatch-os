import Link from "next/link";
import { adminStateActionClass } from "@/components/admin/admin-state";
import { placementHref } from "@/lib/admin/placement/placement-rules";
import type { PlacementQuery } from "@/lib/admin/placement/placement-types";
import { addDays, isShiftDate, tokyoDate } from "@/lib/admin/shifts/shift-view-rules";

const controlClass = "mt-1.5 min-h-11 w-full min-w-0 rounded-control border border-border-strong bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const submitClass = "min-h-11 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function PlacementDateNavigation({ query }: { query: PlacementQuery }) {
  const label = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "short",
  }).format(new Date(`${query.date}T00:00:00Z`));
  const previous = addDays(query.date, -1);
  const next = addDays(query.date, 1);
  const dayHref = (date: string) => placementHref(query, { date, shift: "", page: 1 });
  return (
    <section aria-label="対象日" className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{label}</h2>
        <p className="mt-1 text-xs text-foreground-muted">Asia/Tokyo・シフトの開始日を基準に表示</p>
        <nav aria-label="配置の対象日移動" className="mt-3 flex flex-wrap gap-2">
          {isShiftDate(previous) ? <Link href={dayHref(previous)} className={adminStateActionClass}>前日</Link> : <span aria-disabled="true" className={`${adminStateActionClass} text-foreground-disabled`}>前日</span>}
          <Link href={dayHref(tokyoDate(new Date()))} className={adminStateActionClass}>今日</Link>
          {isShiftDate(next) ? <Link href={dayHref(next)} className={adminStateActionClass}>翌日</Link> : <span aria-disabled="true" className={`${adminStateActionClass} text-foreground-disabled`}>翌日</span>}
        </nav>
      </div>
      <form key={placementHref(query)} action="/admin/placement" method="get" className="flex min-w-0 flex-wrap items-end gap-3">
        {query.q && <input type="hidden" name="q" value={query.q} />}
        {query.project && <input type="hidden" name="project" value={query.project} />}
        {query.staffing !== "all" && <input type="hidden" name="staffing" value={query.staffing} />}
        <label className="min-w-0 flex-1 text-sm font-medium">
          日付を指定
          <input name="date" type="date" min="0100-01-01" max="9998-12-31" defaultValue={query.date} className={controlClass} />
        </label>
        <button type="submit" className={adminStateActionClass}>表示</button>
      </form>
    </section>
  );
}

export function PlacementFilters({ query, projects }: { query: PlacementQuery; projects: [string, string][] }) {
  const unknownProject = query.project && !projects.some(([id]) => id === query.project);
  return (
    <form key={placementHref(query)} action="/admin/placement" method="get" aria-label="配置の絞り込み" className="rounded-panel border border-border bg-surface p-4">
      <input type="hidden" name="date" value={query.date} />
      {query.shift && <input type="hidden" name="shift" value={query.shift} />}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="min-w-0 text-sm font-medium">
          検索
          <input name="q" type="search" defaultValue={query.q} maxLength={100} placeholder="案件・業務・勤務先" className={controlClass} />
        </label>
        <label className="min-w-0 text-sm font-medium">
          案件
          <select name="project" defaultValue={query.project} className={controlClass}>
            <option value="">すべての案件</option>
            {unknownProject && <option value={query.project}>対象日の候補にない案件（選択中）</option>}
            {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">
          配置状況
          <select name="staffing" defaultValue={query.staffing} className={controlClass}>
            <option value="all">すべて</option>
            <option value="shortage">不足（未配置を含む）</option>
            <option value="filled">充足</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {query.shift ? <p className="text-sm text-foreground-secondary">シフトを指定して表示中</p> : <span />}
        <div className="flex flex-wrap gap-3">
          <Link href={placementHref(query, { q: "", project: "", staffing: "all", shift: "", page: 1 })} className={adminStateActionClass}>条件をリセット</Link>
          <button type="submit" className={submitClass}>検索</button>
        </div>
      </div>
    </form>
  );
}
