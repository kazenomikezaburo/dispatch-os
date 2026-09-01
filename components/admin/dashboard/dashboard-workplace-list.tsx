import type { DashboardWorkplace } from "@/lib/admin/dashboard/dashboard-types";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardWorkplaceItem } from "./dashboard-workplace-item";

export function DashboardWorkplaceList({ workplaces }: { workplaces: DashboardWorkplace[] }) {
  return (
    <section aria-labelledby="dashboard-workplaces-title">
      <div className="mb-4">
        <h2
          id="dashboard-workplaces-title"
          className="text-lg font-semibold text-slate-950 sm:text-xl"
        >
          今日の現場
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          配置状況と確認が必要な現場を表示します。
        </p>
      </div>
      {workplaces.length === 0 ? (
        <DashboardEmptyState message="本日の勤務予定はありません" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1.5fr)_10rem_minmax(12rem,1fr)_8rem] gap-5 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-500 md:grid"
          >
            <span>案件 / 現場</span>
            <span>配置状況</span>
            <span>達成率</span>
            <span>状態</span>
          </div>
          <ul className="divide-y divide-slate-200">
            {workplaces.map((workplace) => (
              <DashboardWorkplaceItem key={workplace.id} workplace={workplace} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
