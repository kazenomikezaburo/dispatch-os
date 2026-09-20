import { connection } from "next/server";
import { AdminErrorState } from "@/components/admin/admin-state";
import { AdminPage as AdminPageLayout } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAttentionList } from "@/components/admin/dashboard/dashboard-attention-list";
import { DashboardSummary } from "@/components/admin/dashboard/dashboard-summary";
import { DashboardWorkplaceList } from "@/components/admin/dashboard/dashboard-workplace-list";
import { getAdminAttention } from "@/lib/admin/attention/get-admin-attention";
import { getDashboardData } from "@/lib/admin/dashboard/get-dashboard-data";

export default async function AdminPage() {
  await connection();
  const now = new Date();
  const [dashboardResult, attentionResult] = await Promise.all([
    getDashboardData(now),
    getAdminAttention(now),
  ]);
  return (
    <AdminPageLayout>
      <AdminPageHeader
        title="ホーム"
        description="今日の稼働状況と、いま対応が必要なことを確認できます。"
      />
      {attentionResult.ok ? (
        <DashboardAttentionList items={attentionResult.data.items.slice(0, 4)} total={attentionResult.data.summary.total} />
      ) : (
        <AdminErrorState title="要対応を取得できませんでした。" />
      )}
      {dashboardResult.ok && attentionResult.ok ? (
        <DashboardSummary summary={dashboardResult.data.summary} attention={attentionResult.data.summary} />
      ) : null}
      {dashboardResult.ok ? (
        <DashboardWorkplaceList workplaces={dashboardResult.data.workplaces} />
      ) : (
        <AdminErrorState title="本日の稼働状況を取得できませんでした。" />
      )}
    </AdminPageLayout>
  );
}
