import type { DashboardAlert } from "@/lib/admin/dashboard/dashboard-types";
import { DashboardAlertItem } from "./dashboard-alert-item";
import { DashboardEmptyState } from "./dashboard-empty-state";

export function DashboardAlertList({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <section aria-labelledby="dashboard-alerts-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><h2 id="dashboard-alerts-title" className="text-xl font-semibold text-slate-950">対応が必要</h2><p className="mt-1 text-sm text-slate-600">優先度の高い項目から表示しています。</p></div>
        <p className="text-sm font-medium text-slate-600">{alerts.length}件</p>
      </div>
      {alerts.length === 0 ? (
        <DashboardEmptyState message="現在、対応が必要な項目はありません" />
      ) : (
        <ul className="space-y-3">{alerts.map((alert) => <DashboardAlertItem key={alert.id} alert={alert} />)}</ul>
      )}
    </section>
  );
}
