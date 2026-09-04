import Link from "next/link";
import { AdminEmptyState, AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AttendanceFilters, attendanceHref } from "@/components/admin/attendance/attendance-filters";
import { AttendanceList } from "@/components/admin/attendance/attendance-list";
import { AttendanceSummary } from "@/components/admin/attendance/attendance-summary";
import { getAttendance } from "@/lib/admin/attendance/get-attendance";
import { getTokyoDate, parseAttendanceQuery } from "@/lib/admin/attendance/attendance-query-schema";

export default async function AttendancePage({ searchParams }: PageProps<"/admin/attendance">) {
  const query = parseAttendanceQuery(await searchParams);
  const result = await getAttendance(query);
  const filtered = query.state !== "all" || query.confirmation !== "all" || query.attention !== "all" || query.q !== "";
  return (
    <AdminPage>
      <AdminPageHeader title="勤怠" description="スタッフの勤務実績と確認状態を管理します。" />
      <AttendanceFilters query={query} today={getTokyoDate()} />
      {!result.ok ? (
        <AdminErrorState title="勤怠情報を取得できませんでした。" />
      ) : (
        <>
          <AttendanceSummary summary={result.data.summary} />
          {result.data.items.length > 0 ? (
            <>
              <AttendanceList items={result.data.items} total={result.data.totalFiltered} />
              <Pagination query={query} total={result.data.totalFiltered} pageSize={result.data.pageSize} />
            </>
          ) : (
            <AdminEmptyState
              title={result.data.totalAssignments === 0 ? "対象日に勤怠対象がありません" : "条件に一致する勤怠はありません"}
              description={filtered && result.data.totalAssignments > 0 ? "検索条件を変更してください。" : "別の日付を選択してください。"}
            />
          )}
        </>
      )}
    </AdminPage>
  );
}

function Pagination({ query, total, pageSize }: { query: ReturnType<typeof parseAttendanceQuery>; total: number; pageSize: number }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="勤怠ページ" className="flex items-center justify-between">
      {query.page <= 1 ? <span aria-disabled="true" className={`${adminStateActionClass} opacity-50`}>前へ</span> : <Link href={attendanceHref(query, { page: query.page - 1 })} className={adminStateActionClass}>前へ</Link>}
      <span className="text-sm text-foreground-secondary">{query.page} / {pages}</span>
      {query.page >= pages ? <span aria-disabled="true" className={`${adminStateActionClass} opacity-50`}>次へ</span> : <Link href={attendanceHref(query, { page: query.page + 1 })} className={adminStateActionClass}>次へ</Link>}
    </nav>
  );
}
