import { DashboardSummaryCard } from "./dashboard-summary-card";
import type { AttentionSummary } from "@/lib/admin/attention/attention-types";
import type { DashboardData } from "@/lib/admin/dashboard/dashboard-types";

export function DashboardSummary({ summary, attention }: { summary: DashboardData["summary"]; attention: AttentionSummary }) {
  return (
    <section aria-labelledby="dashboard-summary-title" className="rounded-panel border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4"><h2 id="dashboard-summary-title" className="text-lg font-semibold text-foreground sm:text-xl">今日のサマリー</h2><p className="mt-1 text-sm text-foreground-secondary">本日の稼働と要対応の内訳です。</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardSummaryCard
        label="本日の稼働"
        value={summary.activeWorkers}
        unit="名"
        description="本日予定されているスタッフ"
        tone="primary"
      />
      <DashboardSummaryCard
        label="正常稼働"
        value={summary.normalWorkers}
        unit="名"
        description="問題なく稼働中"
        tone="success"
      />
      <DashboardSummaryCard
        label="要確認"
        value={attention.total}
        unit="件"
        description="確認・対応が必要"
        tone="attention"
      />
      <DashboardSummaryCard label="SOS" value={attention.urgent} unit="件" description="優先対応してください" tone="danger" />
      </div>
    </section>
  );
}
