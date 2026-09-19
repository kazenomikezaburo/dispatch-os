import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminEmptyState, AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
import { MasterEditor } from "@/components/admin/masters/master-editor";
import { MasterFilters } from "@/components/admin/masters/master-filters";
import { MasterList } from "@/components/admin/masters/master-list";
import { MasterWorkspaceHeader } from "@/components/admin/masters/master-workspace-header";
import { getWorkplaces } from "@/lib/admin/masters/get-masters";
import { masterHref, pageCount, parseMasterQuery } from "@/lib/admin/masters/master-rules";

export default async function WorkplacesPage({ searchParams }: PageProps<"/admin/workplaces">) {
  const query = parseMasterQuery(await searchParams);
  const result = await getWorkplaces(query);
  const filtered = Boolean(query.q || query.status !== "all");

  return (
    <AdminPage>
      <MasterWorkspaceHeader />
      <section aria-labelledby="workplaces-title" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 id="workplaces-title" className="text-xl font-semibold text-foreground">勤務先一覧</h2><p className="mt-1 text-sm text-foreground-muted">業務で使用する勤務先・会場マスタを管理します。</p></div>
          {result.ok && result.branches.length > 0 && <div className="shrink-0"><MasterEditor kind="workplace" branches={result.branches} /></div>}
        </div>
        {result.ok && <section aria-label="勤務先集計" className="grid gap-3 sm:grid-cols-2"><Metric label="登録勤務先" value={result.total} /><Metric label="有効" value={result.active} /></section>}
        <MasterFilters path="/admin/workplaces" query={query} placeholder="勤務先名・住所" />
        {!result.ok ? <AdminErrorState title="勤務先を取得できませんでした。" /> : result.items.length === 0 ? (
          <AdminEmptyState title={filtered ? "条件に一致する勤務先はありません" : "まだ勤務先が登録されていません"} description={filtered ? "検索条件を変更してください。" : "勤務先を追加すると業務で選択できます。"}>
            {!filtered && <MasterEditor kind="workplace" branches={result.branches} />}
          </AdminEmptyState>
        ) : <><MasterList kind="workplace" items={result.items} branches={result.branches} /><Pager path="/admin/workplaces" query={query} total={result.total} label="勤務先" /></>}
      </section>
    </AdminPage>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-panel border border-border bg-surface p-4"><p className="text-sm text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{value}件</p></div>;
}

function Pager({ path, query, total, label }: { path: string; query: ReturnType<typeof parseMasterQuery>; total: number; label: string }) {
  const pages = pageCount(total);
  if (pages <= 1) return null;
  return <nav aria-label={`${label}ページ`} className="flex items-center justify-between">{query.page <= 1 ? <span aria-disabled="true" className={`${adminStateActionClass} opacity-50`}>前へ</span> : <Link href={masterHref(path, query, { page: query.page - 1 })} className={adminStateActionClass}>前へ</Link>}<span className="text-sm">{query.page} / {pages}</span>{query.page >= pages ? <span aria-disabled="true" className={`${adminStateActionClass} opacity-50`}>次へ</span> : <Link href={masterHref(path, query, { page: query.page + 1 })} className={adminStateActionClass}>次へ</Link>}</nav>;
}
