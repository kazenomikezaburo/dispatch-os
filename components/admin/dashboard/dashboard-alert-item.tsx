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

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${alert.severity === "critical" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
            {alert.severity === "critical" ? "要対応" : "確認"}
          </span>
          <h3 className="mt-3 text-base font-semibold text-slate-950">{alert.title}</h3>
          {workerName && <p className="mt-1 text-sm font-medium text-slate-800">{workerName}</p>}
          <p className="mt-1 text-sm text-slate-600">{alert.projectName} / {alert.workplaceName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {alert.type === "staffing_shortage" ? alert.description : `予定 ${tokyoTimeFormatter.format(new Date(alert.startsAt))}`}
          </p>
        </div>
        <Link href={alert.href} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          {alert.type === "attendance_missing" ? "勤怠を見る" : "配置を見る"}<span aria-hidden="true" className="ml-1">›</span>
        </Link>
      </div>
    </li>
  );
}
