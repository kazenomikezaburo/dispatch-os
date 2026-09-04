import { AdminPage } from "@/components/admin/admin-page";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import Link from "next/link";
import { AdminEmptyState, AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
import { ShiftEmptyState } from "@/components/admin/shifts/shift-empty-state";
import { ShiftFilters } from "@/components/admin/shifts/shift-filters";
import { ShiftList } from "@/components/admin/shifts/shift-list";
import { ShiftPageHeader } from "@/components/admin/shifts/shift-page-header";
import { getShifts } from "@/lib/admin/shifts/get-shifts";
import { parseShiftQuery } from "@/lib/admin/shifts/shift-query-schema";
import { parseShiftView, shiftViewHref, shiftViewRange, tokyoDate } from "@/lib/admin/shifts/shift-view-rules";
import { ShiftSummary } from "@/components/admin/shifts/shift-summary";
import { ShiftViewControls } from "@/components/admin/shifts/shift-view-controls";
import { ShiftScheduleViews } from "@/components/admin/shifts/shift-schedule-views";

export default async function ShiftsPage({ searchParams }: PageProps<"/admin/shifts">) {
  const raw = await searchParams;
  const now = new Date();
  const query = parseShiftQuery(raw);
  const state = parseShiftView(raw, now);
  const result = await getShifts(query, now, shiftViewRange(state));
  const filtered = query.q !== "" || query.period !== "upcoming" || query.status !== "all" || query.staffing !== "all";
  const summaryShifts = result.ok ? state.view === "calendar" ? result.shifts.filter((shift) => tokyoDate(shift.startsAt).startsWith(state.month)) : result.shifts : [];
  const scope = state.view === "calendar" ? `${state.month}（月外の日付を除く）` : state.view === "week" ? "表示中の7日間" : state.date || "一覧の対象期間";

  return <AdminPage><ShiftPageHeader />
    <AdminSectionNav label="案件・シフト" items={[{ label: "案件", href: "/admin/projects" }, { label: "シフト", href: "/admin/shifts", current: true }]} />
    {result.ok && <ShiftSummary shifts={summaryShifts} scope={scope} />}
    <ShiftFilters query={query} state={state} />
    <ShiftViewControls query={query} state={state} />
    {!result.ok ? <AdminErrorState title="シフト一覧を取得できませんでした。"><a href={shiftViewHref(query, state)} className={adminStateActionClass}>再読み込み</a></AdminErrorState> : state.view === "list" ? result.shifts.length === 0 ? <ShiftEmptyState filtered={filtered || !!state.date} /> : <ShiftList shifts={result.shifts} /> : <>
      {!summaryShifts.length && <AdminEmptyState title="この期間のシフトはありません。" description="前後の期間へ移動するか、検索条件を変更してください。"><Link href={shiftViewHref({ q: "", period: "upcoming", status: "all", staffing: "all" }, state)} className={adminStateActionClass}>検索条件をクリア</Link></AdminEmptyState>}
      <ShiftScheduleViews shifts={result.shifts} query={query} state={state} />
    </>}
  </AdminPage>;
}
