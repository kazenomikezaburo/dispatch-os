import Link from "next/link";
import { AdminEmptyState, AdminErrorState, AdminNotFoundState, adminStateActionClass } from "@/components/admin/admin-state";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { DayOfMonitor } from "@/components/admin/day-of/day-of-monitor";
import { DayOfDrawer } from "@/components/admin/day-of/day-of-drawer";
import { getDayOf } from "@/lib/admin/day-of/get-day-of";
import { dayOfHref, parseDayOfQuery } from "@/lib/admin/day-of/day-of-rules";
import { addDays, shiftDayLabel, tokyoDate } from "@/lib/admin/shifts/shift-view-rules";

const control = "mt-1.5 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-focus-ring";

export default async function DayOfPage({ searchParams }: PageProps<"/admin/day-of">) {
  const query = parseDayOfQuery(await searchParams);
  const result = await getDayOf(query);
  const all = result.ok ? result.all : [];
  const projects = result.ok ? [...new Map(all.map((item) => [item.projectId, item.projectName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "ja")) : [];
  const selected = result.ok ? all.find((item) => item.assignmentId === query.assignment) : undefined;
  const shifts = new Set(all.map((item) => item.shiftId)).size;
  const today = query.date === tokyoDate(new Date());
  const summary = [
    ["対象シフト", shifts, "件"],
    ["勤務予定", all.length, "名"],
    ["勤務中", all.filter((item) => item.state === "working").length, "名"],
    ["勤務終了", all.filter((item) => item.state === "finished").length, "名"],
    ["要確認", all.filter((item) => item.attentionReason || item.incidentAttention).length, "名"],
  ] as const;
  const filtered = Boolean(query.q || query.project || query.state !== "all");

  return <AdminPage>
    <AdminPageHeader title="当日運用" description="当日の勤務状態と要確認スタッフを、実在する勤務・打刻情報から確認します。" />
    <AdminSectionNav label="案件・運用" items={[{ label: "シフト", href: "/admin/shifts" }, { label: "配置・休憩", href: "/admin/placement" }, { label: "前日確認", href: "/admin/pre-shift" }, { label: "当日運用", href: "/admin/day-of", current: true }, { label: "勤怠", href: "/admin/attendance" }]} />

    <section aria-label="日付" className="flex flex-col gap-3 rounded-panel border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-semibold">{shiftDayLabel(query.date)}</p>
        {today && <span className="rounded-full bg-info-subtle px-2 py-0.5 text-xs font-semibold text-info">今日</span>}
        <p className="text-xs text-foreground-muted">Asia/Tokyo・シフト開始日基準</p>
        <div className="flex flex-wrap gap-2">
          <Link href={dayOfHref(query, { date: addDays(query.date, -1), assignment: "" })} className={adminStateActionClass}>前日</Link>
          <Link href={dayOfHref(query, { date: tokyoDate(new Date()), assignment: "" })} className={adminStateActionClass}>今日へ</Link>
          <Link href={dayOfHref(query, { date: addDays(query.date, 1), assignment: "" })} className={adminStateActionClass}>翌日</Link>
        </div>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-medium">日付を指定<input name="date" type="date" defaultValue={query.date} className={`${control} w-auto`} /></label>
        <button className="min-h-11 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground">表示</button>
      </form>
    </section>

    {result.ok && <section aria-label="集計" className="grid overflow-hidden rounded-panel border border-border bg-surface sm:grid-cols-2 xl:grid-cols-5">
      {summary.map(([label, value, unit]) => <div key={label} className={`border-border px-4 py-3 sm:border-r sm:last:border-r-0 ${label === "要確認" && value ? "bg-warning-subtle/40" : ""}`}>
        <p className="text-xs text-foreground-muted">{label}</p>
        <p className={`mt-0.5 text-xl font-semibold tabular-nums ${label === "要確認" && value ? "text-warning-foreground" : ""}`}>{value}<span className="ml-1 text-xs font-normal text-foreground-muted">{unit}</span></p>
      </div>)}
    </section>}

    <form method="get" className="rounded-panel border border-border bg-surface p-4">
      <input type="hidden" name="date" value={query.date} />
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1fr)_minmax(11rem,1fr)_auto] md:items-end">
        <label className="text-sm font-medium">検索<input name="q" type="search" defaultValue={query.q} placeholder="スタッフ・案件・業務・勤務先" maxLength={100} className={control} /></label>
        <label className="text-sm font-medium">案件<select name="project" defaultValue={query.project} className={control}><option value="">すべての案件</option>{projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-sm font-medium">勤務状態<select name="state" defaultValue={query.state} className={control}><option value="all">すべて</option><option value="attention">要確認</option><option value="scheduled">勤務前・開始未報告</option><option value="working">勤務中</option><option value="finished">勤務終了</option></select></label>
        <button className="min-h-11 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground">検索</button>
      </div>
      {filtered && <div className="mt-3 flex justify-end"><Link href={`/admin/day-of?date=${query.date}`} className={adminStateActionClass}>条件をリセット</Link></div>}
    </form>

    {!result.ok ? <AdminErrorState title="当日運用情報を取得できませんでした。" /> : all.length === 0 ? <AdminEmptyState title="この日の勤務予定はありません。" description="前後の日付を選択してください。" /> : result.items.length === 0 ? <AdminEmptyState title="条件に一致するスタッフはいません。" description={filtered ? "検索条件を変更してください。" : "別の日付を選択してください。"} /> : <DayOfMonitor items={result.items} query={query} />}
    {query.assignment && (selected ? <DayOfDrawer item={selected} date={query.date} closeHref={dayOfHref(query, { assignment: "" })} /> : <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--surface-overlay)] p-4"><AdminNotFoundState><Link href={dayOfHref(query, { assignment: "" })} className={adminStateActionClass}>一覧へ戻る</Link></AdminNotFoundState></div>)}
  </AdminPage>;
}
