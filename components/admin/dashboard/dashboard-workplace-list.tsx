import type { DashboardWorkplace } from "@/lib/admin/dashboard/dashboard-types";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardWorkplaceItem } from "./dashboard-workplace-item";

export function DashboardWorkplaceList({ workplaces }: { workplaces: DashboardWorkplace[] }) {
  return (
    <section aria-labelledby="dashboard-workplaces-title">
      <div className="mb-4"><h2 id="dashboard-workplaces-title" className="text-xl font-semibold text-slate-950">今日の現場</h2><p className="mt-1 text-sm text-slate-600">配置状況と確認が必要な現場を表示します。</p></div>
      {workplaces.length === 0 ? <DashboardEmptyState message="本日の現場はありません" /> : <ul className="space-y-3">{workplaces.map((workplace) => <DashboardWorkplaceItem key={workplace.id} workplace={workplace} />)}</ul>}
    </section>
  );
}
