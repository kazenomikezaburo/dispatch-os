import Link from "next/link";
import type { DashboardWorkplace } from "@/lib/admin/dashboard/dashboard-types";

const tokyoTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function DashboardWorkplaceItem({ workplace }: { workplace: DashboardWorkplace }) {
  const progressWidth = Math.min(Math.max(workplace.progress, 0), 100);
  const attention = workplace.status === "attention";

  return (
    <li className="p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_10rem_minmax(12rem,1fr)_8rem] md:items-center md:gap-5">
        <div className="min-w-0">
          <Link
            href={workplace.href}
            className="inline-flex min-h-11 items-center font-semibold text-blue-700 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:min-h-0"
          >
            {workplace.projectName}
          </Link>
          <p className="truncate text-sm text-slate-600">{workplace.workplaceName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {tokyoTimeFormatter.format(new Date(workplace.startsAt))}〜
            {tokyoTimeFormatter.format(new Date(workplace.endsAt))}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 md:hidden">配置状況</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 md:mt-0">
            {workplace.assignedWorkers} / {workplace.requiredWorkers}名
          </p>
          {workplace.shortage > 0 && (
            <p className="mt-1 text-xs font-semibold text-red-700">
              不足 {workplace.shortage}名
            </p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-500 md:sr-only">達成率</span>
            <span className="text-xs font-medium text-slate-600">
              {workplace.progress}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${workplace.projectName}の配置率 ${workplace.progress}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressWidth}
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className={`h-full rounded-full ${attention ? "bg-amber-500" : "bg-emerald-600"}`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>
        <div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${attention ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${attention ? "bg-amber-500" : "bg-emerald-600"}`}
            />
            {attention
              ? `要確認${workplace.shortage > 0 ? ` ${workplace.shortage}名` : ""}`
              : "正常"}
          </span>
        </div>
      </div>
    </li>
  );
}
