import { DashboardSummaryCard } from "./dashboard-summary-card";
import type { DashboardData } from "@/lib/admin/dashboard/dashboard-types";

export function DashboardSummary({ summary }: { summary: DashboardData["summary"] }) {
  return (
    <section aria-label="本日の集計" className="grid gap-4 sm:grid-cols-3">
      <DashboardSummaryCard label="本日の稼働" value={summary.activeWorkers} unit="名" />
      <DashboardSummaryCard label="正常" value={summary.normalWorkers} unit="名" />
      <DashboardSummaryCard label="要確認" value={summary.alertCount} unit="件" tone="attention" />
    </section>
  );
}
