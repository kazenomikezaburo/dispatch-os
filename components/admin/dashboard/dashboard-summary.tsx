import { DashboardSummaryCard } from "./dashboard-summary-card";
import type { DashboardData } from "@/lib/admin/dashboard/dashboard-types";

export function DashboardSummary({ summary }: { summary: DashboardData["summary"] }) {
  return (
    <section
      aria-label="本日の集計"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4"
    >
      <DashboardSummaryCard
        label="本日の稼働"
        value={summary.activeWorkers}
        unit="名"
        description="本日予定されているスタッフ"
        tone="primary"
      />
      <DashboardSummaryCard
        label="正常"
        value={summary.normalWorkers}
        unit="名"
        description="個別の要確認がないスタッフ"
        tone="success"
      />
      <DashboardSummaryCard
        label="要確認"
        value={summary.alertCount}
        unit="件"
        description="確認・対応が必要"
        tone="attention"
      />
    </section>
  );
}
