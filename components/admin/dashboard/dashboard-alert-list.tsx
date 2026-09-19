import type { DashboardAlert } from "@/lib/admin/dashboard/dashboard-types";
import { DashboardAlertItem } from "./dashboard-alert-item";
import { DashboardEmptyState } from "./dashboard-empty-state";

export function DashboardAlertList({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <section aria-labelledby="dashboard-alerts-title">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="dashboard-alerts-title"
            className="text-lg font-semibold text-foreground sm:text-xl"
          >
            対応が必要
          </h2>
          <span className="inline-flex min-w-9 items-center justify-center rounded-pill bg-danger-subtle px-2.5 py-1 text-xs font-semibold text-danger-foreground">
            {alerts.length}件
          </span>
        </div>
        <p className="mt-1 text-sm text-foreground-secondary">
          優先度の高い項目から表示しています。
        </p>
      </div>
      {alerts.length === 0 ? (
        <DashboardEmptyState message="現在、対応が必要な項目はありません" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">
          {alerts.map((alert) => (
            <DashboardAlertItem key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  );
}
