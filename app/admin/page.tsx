import { connection } from "next/server";
import { AdminPage as AdminPageLayout } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAlertList } from "@/components/admin/dashboard/dashboard-alert-list";
import { DashboardSummary } from "@/components/admin/dashboard/dashboard-summary";
import { DashboardWorkplaceList } from "@/components/admin/dashboard/dashboard-workplace-list";
import { getDashboardData } from "@/lib/admin/dashboard/get-dashboard-data";

export default async function AdminPage() {
  await connection();
  const result = await getDashboardData();

  if (!result.ok) {
    return (
      <AdminPageLayout>
        <AdminPageHeader title="管理ダッシュボード" />
        <div role="alert" className="rounded-lg border border-red-200 bg-white p-5">
          <p className="font-semibold text-slate-950">ダッシュボードを取得できませんでした。</p>
          <p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p>
        </div>
      </AdminPageLayout>
    );
  }

  const { data } = result;
  return (
    <AdminPageLayout>
      <AdminPageHeader
        title="管理ダッシュボード"
        description="今日の稼働状況と、いま対応が必要なことを確認できます。"
      />
      <DashboardSummary summary={data.summary} />
      <DashboardAlertList alerts={data.alerts} />
      <DashboardWorkplaceList workplaces={data.workplaces} />
    </AdminPageLayout>
  );
}
