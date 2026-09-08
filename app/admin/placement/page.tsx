import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState, AdminErrorState, AdminNotFoundState, adminStateActionClass } from "@/components/admin/admin-state";
import { PlacementBoard, PlacementPagination, PlacementSummary } from "@/components/admin/placement/placement-board";
import { PlacementDateNavigation, PlacementFilters } from "@/components/admin/placement/placement-filters";
import { getPlacement } from "@/lib/admin/placement/get-placement";
import { getPlacementPlan } from "@/lib/admin/placement/get-placement-plan";
import { PlacementEditor } from "@/components/admin/placement/placement-editor";
import { filterPlacement, paginatePlacement, parsePlacementQuery, placementHref } from "@/lib/admin/placement/placement-rules";

export default async function PlacementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parsePlacementQuery(await searchParams);
  const result = await getPlacement(query.date);
  const shifts = result.ok ? result.shifts : [];
  const filtered = filterPlacement(shifts, query);
  const paginated = paginatePlacement(filtered, query.page);
  const projects = [...new Map(shifts.map((shift) => [shift.projectId, shift.projectName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "ja"));
  const missingShift = result.ok && query.shift && !shifts.some((shift) => shift.id === query.shift);
  const resetHref = placementHref(query, { q: "", project: "", staffing: "all", shift: "", page: 1 });
  const selectedShift = result.ok && query.shift ? shifts.find((shift) => shift.id === query.shift) : undefined;
  const selectedPlan = selectedShift ? await getPlacementPlan(selectedShift.id) : null;
  const closeHref = placementHref(query, { shift: "" });

  return (
    <AdminPage>
      <AdminPageHeader title="配置・休憩回し" description="シフトごとの必要人数と配置状況を確認・管理します。" />
      <PlacementDateNavigation query={query} />
      {result.ok && <PlacementSummary shifts={filtered} />}
      <PlacementFilters query={query} projects={projects} />
      <p className="text-sm text-foreground-muted">既存のシフトAssignmentをポジションへ配置し、スタッフ別の休憩回しを計画できます。</p>
      {!result.ok ? (
        <AdminErrorState title="配置状況を取得できませんでした。">
          <a href={placementHref(query)} className={adminStateActionClass}>再読み込み</a>
        </AdminErrorState>
      ) : missingShift ? (
        <AdminNotFoundState><Link href={resetHref} className={adminStateActionClass}>対象日の一覧へ戻る</Link></AdminNotFoundState>
      ) : shifts.length === 0 ? (
        <AdminEmptyState title="この日に開始するシフトはありません。" description="前後の日付を選ぶか、シフト一覧を確認してください。">
          <Link href={`/admin/shifts?view=list&date=${query.date}`} className={adminStateActionClass}>シフト一覧へ</Link>
        </AdminEmptyState>
      ) : filtered.length === 0 ? (
        <AdminEmptyState title="条件に一致するシフトはありません。" description="検索・案件・配置状況の条件を変更してください。">
          <Link href={resetHref} className={adminStateActionClass}>条件をリセット</Link>
        </AdminEmptyState>
      ) : (
        <section aria-labelledby="placement-list-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="placement-list-heading" className="text-lg font-semibold">シフト別の配置</h2>
            <p className="text-sm text-foreground-muted">{filtered.length}件{paginated.pages > 1 && `・${paginated.page} / ${paginated.pages}ページ`}</p>
          </div>
          <PlacementBoard shifts={paginated.items} query={query} />
          <PlacementPagination query={query} page={paginated.page} pages={paginated.pages} />
        </section>
      )}
      {selectedShift && selectedPlan && <PlacementEditor initial={selectedPlan} closeHref={closeHref} shiftLabel={`${selectedShift.projectName} / ${selectedShift.jobName}`} />}
    </AdminPage>
  );
}
