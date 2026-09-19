import Link from "next/link";
import type { ReactNode } from "react";
import { ShiftStatusBadge } from "@/components/admin/shifts/shift-status-badge";
import { shiftOperationItems, type ShiftOperationPhase } from "@/components/admin/admin-detail-workflow-routes";
import {
  adminNavigationTabActiveClass,
  adminNavigationTabBaseClass,
  adminWorkflowTabClass,
} from "@/components/admin/admin-navigation-tab-styles";
import { cn } from "@/lib/utils/cn";
import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";

export type ShiftOperationContextModel = {
  id: string;
  projectId: string;
  projectName: string;
  jobName: string;
  workplaceName: string;
  startsAt: string;
  endsAt: string;
  status?: ShiftStatus;
};

export type ShiftOperationMetric = {
  label: "必要人数" | "配置済み" | "未配置" | "応募" | "確認済み";
  value: number;
};

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });

export function ShiftOperationContext({ context, phase, metrics, action }: { context: ShiftOperationContextModel; phase: ShiftOperationPhase; metrics: readonly ShiftOperationMetric[]; action?: ReactNode }) {
  const date = tokyoDate(context.startsAt);
  const items = shiftOperationItems({ projectId: context.projectId, shiftId: context.id, date, active: phase });

  return <section aria-labelledby="shift-operation-context-title" className="space-y-4">
    <div className="rounded-panel border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground-muted">選択中のシフト</p>
          <h2 id="shift-operation-context-title" className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {day.format(new Date(context.startsAt))} {time.format(new Date(context.startsAt))}〜{time.format(new Date(context.endsAt))}
          </h2>
          <p className="mt-2 break-words text-sm font-semibold text-foreground">{context.projectName}</p>
          <p className="mt-1 break-words text-sm text-foreground-secondary">{context.jobName} / {context.workplaceName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {context.status && <ShiftStatusBadge status={context.status} />}
          {action}
        </div>
      </div>
    </div>

    <nav aria-label="シフト運用工程" className="overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1">
        {items.map((item) => <Link key={item.key} href={item.href} aria-current={item.current ? "page" : undefined} className={cn(
          adminNavigationTabBaseClass,
          adminWorkflowTabClass,
          item.current && adminNavigationTabActiveClass,
        )}>{item.label}</Link>)}
      </div>
    </nav>

    {metrics.length > 0 && <dl aria-label="選択中シフトの集計" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((metric) => <div key={metric.label} className="rounded-panel border border-border bg-surface p-4">
        <dt className="text-xs text-foreground-muted">{metric.label}</dt>
        <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{metric.value}<span className="ml-1 text-xs font-normal text-foreground-muted">名</span></dd>
      </div>)}
    </dl>}
  </section>;
}

function tokyoDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
