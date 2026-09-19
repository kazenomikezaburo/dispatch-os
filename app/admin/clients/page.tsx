import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminEmptyState, AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
import { MasterEditor } from "@/components/admin/masters/master-editor";
import { MasterFilters } from "@/components/admin/masters/master-filters";
import { MasterList } from "@/components/admin/masters/master-list";
import { MasterWorkspaceHeader } from "@/components/admin/masters/master-workspace-header";
import { getClients } from "@/lib/admin/masters/get-masters";
import { masterHref, pageCount, parseMasterQuery } from "@/lib/admin/masters/master-rules";

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  const query = parseMasterQuery(await searchParams);
  const result = await getClients(query);
  const filtered = Boolean(query.q || query.status !== "all");

  return (
    <AdminPage>
      <MasterWorkspaceHeader />
      <section aria-labelledby="clients-title" className="space-y-6">
        <DomainHeader title="取引先一覧" description="案件で使用する取引先マスタを管理します。" action={result.ok && result.branches.length > 0 ? <MasterEditor kind="client" branches={result.branches} /> : undefined} />
        {result.ok && <Metrics totalLabel="登録取引先" total={result.total} active={result.active} domain="取引先" />}
        <MasterFilters path="/admin/clients" query={query} placeholder="取引先名" />
        {!result.ok ? <AdminErrorState title="取引先を取得できませんでした。" /> : result.items.length === 0 ? (
          <AdminEmptyState title={filtered ? "条件に一致する取引先はありません" : "まだ取引先が登録されていません"} description={filtered ? "検索条件を変更してください。" : "取引先を追加すると案件で選択できます。"}>
            {!filtered && <MasterEditor kind="client" branches={result.branches} />}
          </AdminEmptyState>
        ) : <><MasterList kind="client" items={result.items} branches={result.branches} /><Pager path="/admin/clients" query={query} total={result.total} label="取引先" /></>}
      </section>
    </AdminPage>
  );
}

function DomainHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="clients-title" className="text-xl font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-foreground-muted">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}

function Metrics({ totalLabel, total, active, domain }: { totalLabel: string; total: number; active: number; domain: string }) {
  return <section aria-label={`${domain}集計`} className="grid gap-3 sm:grid-cols-2"><Metric label={totalLabel} value={total} /><Metric label="有効" value={active} /></section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-panel border border-border bg-surface p-4"><p className="text-sm text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{value}件</p></div>;
}

function Pager({ path, query, total, label }: { path: string; query: ReturnType<typeof parseMasterQuery>; total: number; label: string }) {
  const pages = pageCount(total);
  if (pages <= 1) return null;
  return <nav aria-label={`${label}ページ`} className="flex items-center justify-between">{query.page <= 1 ? <span aria-disabled="true" className={`${adminStateActionClass} opacity-50`}>前へ</span> : <Link href={masterHref(path, query, { page: query.page - 1 })} className={adminStateActionClass}>前へ</Link>}<span className="text-sm">{query.page} / {pages}</span>{query.page >= pages ? <span aria-disabled="true" className={`${adminStateActionClass} opacity-50`}>次へ</span> : <Link href={masterHref(path, query, { page: query.page + 1 })} className={adminStateActionClass}>次へ</Link>}</nav>;
}
