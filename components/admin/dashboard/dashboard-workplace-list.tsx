import type { DashboardWorkplace } from "@/lib/admin/dashboard/dashboard-types";
import Link from "next/link";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardWorkplaceItem } from "./dashboard-workplace-item";

export function DashboardWorkplaceList({ workplaces }: { workplaces: DashboardWorkplace[] }) {
  return (
    <section aria-labelledby="dashboard-workplaces-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="dashboard-workplaces-title" className="text-lg font-semibold text-foreground sm:text-xl">今日の現場</h2><p className="mt-1 text-sm text-foreground-secondary">配置状況と要対応の現場を確認できます。</p></div>
        <Link href="/admin/shifts" className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-link hover:bg-surface-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">現場一覧を見る<span aria-hidden="true">›</span></Link>
      </div>
      {workplaces.length === 0 ? (
        <DashboardEmptyState message="本日の勤務予定はありません" />
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1.5fr)_10rem_minmax(12rem,1fr)_8rem] gap-5 border-b border-border bg-surface-subtle px-5 py-3 text-xs font-semibold text-foreground-muted md:grid"
          >
            <span>案件 / 現場</span>
            <span>配置状況</span>
            <span>達成率</span>
            <span>状態</span>
          </div>
          <ul className="divide-y divide-border">
            {workplaces.map((workplace) => (
              <DashboardWorkplaceItem key={workplace.id} workplace={workplace} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
