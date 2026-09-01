import { AdminPage } from "@/components/admin/admin-page";
import { ShiftEmptyState } from "@/components/admin/shifts/shift-empty-state";
import { ShiftFilters } from "@/components/admin/shifts/shift-filters";
import { ShiftList } from "@/components/admin/shifts/shift-list";
import { ShiftPageHeader } from "@/components/admin/shifts/shift-page-header";
import { getShifts } from "@/lib/admin/shifts/get-shifts";
import { parseShiftQuery } from "@/lib/admin/shifts/shift-query-schema";

export default async function ShiftsPage({ searchParams }: PageProps<"/admin/shifts">) {
  const query = parseShiftQuery(await searchParams);
  const result = await getShifts(query);
  const filtered = query.q !== "" || query.period !== "upcoming" || query.status !== "all" || query.staffing !== "all";

  return <AdminPage><ShiftPageHeader /><ShiftFilters query={query} />{!result.ok ? <section role="alert" className="rounded-lg border border-red-200 bg-white p-5"><h2 className="font-semibold text-slate-950">シフト一覧を取得できませんでした。</h2><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></section> : result.shifts.length === 0 ? <ShiftEmptyState filtered={filtered} /> : <ShiftList shifts={result.shifts} />}</AdminPage>;
}
