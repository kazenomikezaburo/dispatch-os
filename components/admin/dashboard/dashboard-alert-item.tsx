import Link from "next/link";
import type { DashboardAlert } from "@/lib/admin/dashboard/dashboard-types";

const tokyoTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function DashboardAlertItem({ alert }: { alert: DashboardAlert }) {
  const workerName = alert.type === "staffing_shortage" ? null : alert.workerName;
  const actionLabel =
    alert.type === "attendance_missing"
      ? "勤怠を確認"
      : alert.type === "pre_shift_missing"
        ? "シフトを確認"
        : "配置を確認";
  const severityLabel = alert.severity === "critical" ? "要対応" : "確認";

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden="true"
            className={`mt-1.5 size-2 shrink-0 rounded-full ${alert.severity === "critical" ? "bg-red-600" : "bg-amber-500"}`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="sr-only">{severityLabel}:</span>
              <h3
                className={`text-sm font-semibold ${alert.severity === "critical" ? "text-red-700" : "text-slate-950"}`}
              >
                {workerName ?? `${alert.projectName} / ${alert.workplaceName}`}
              </h3>
              <span className="text-xs font-medium text-slate-500">
                {tokyoTimeFormatter.format(new Date(alert.startsAt))}開始
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {alert.title}
              {alert.type === "staffing_shortage"
                ? ` — ${alert.description}`
                : ` — ${alert.projectName} / ${alert.workplaceName}`}
            </p>
          </div>
        </div>
        <Link
          href={alert.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center self-start rounded-md px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:self-center"
        >
          {actionLabel}
          <span aria-hidden="true" className="ml-1">›</span>
        </Link>
      </div>
    </li>
  );
}
