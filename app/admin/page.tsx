import { connection } from "next/server";
import { AdminErrorState } from "@/components/admin/admin-state";
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
        <AdminPageHeader title="ホーム" />
        <AdminErrorState title="ダッシュボードを取得できませんでした。" />
      </AdminPageLayout>
    );
  }

  const { data } = result;
  return (
    <AdminPageLayout>
      <AdminPageHeader
        title="ホーム"
        description="今日の稼働状況と、いま対応が必要なことを確認できます。"
      />
      <DashboardSummary summary={data.summary} />
      <DashboardAlertList alerts={data.alerts} />
      <DashboardWorkplaceList workplaces={data.workplaces} />
    </AdminPageLayout>
  );
}
