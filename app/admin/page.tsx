import { connection } from "next/server";
import { DashboardAlertList } from "@/components/admin/dashboard/dashboard-alert-list";
import { DashboardSummary } from "@/components/admin/dashboard/dashboard-summary";
import { DashboardWorkplaceList } from "@/components/admin/dashboard/dashboard-workplace-list";
import { getDashboardData } from "@/lib/admin/dashboard/get-dashboard-data";

export default async function AdminPage() {
  await connection();
  const result = await getDashboardData();

  if (!result.ok) {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">管理ダッシュボード</h1>
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-white p-5">
          <p className="font-semibold text-slate-950">ダッシュボードを取得できませんでした。</p>
          <p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p>
        </div>
      </section>
    );
  }

  const { data } = result;
  return (
    <div className="space-y-8 lg:space-y-10">
      <header><h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">管理ダッシュボード</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">本日の稼働・要対応事項を確認します。</p></header>
      {data.workplaces.length === 0 && <p className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">本日の稼働予定はありません</p>}
      <DashboardSummary summary={data.summary} />
      <DashboardAlertList alerts={data.alerts} />
      <DashboardWorkplaceList workplaces={data.workplaces} />
    </div>
  );
}
