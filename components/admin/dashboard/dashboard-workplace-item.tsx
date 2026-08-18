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

  return (
    <li>
      <Link href={workplace.href} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,1fr)_auto] lg:items-center">
          <div className="min-w-0"><h3 className="truncate text-base font-semibold text-slate-950">{workplace.projectName}</h3><p className="mt-1 truncate text-sm text-slate-600">{workplace.workplaceName}</p><p className="mt-2 text-sm text-slate-500">{tokyoTimeFormatter.format(new Date(workplace.startsAt))}〜{tokyoTimeFormatter.format(new Date(workplace.endsAt))}</p></div>
          <div>
            <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-800">{workplace.assignedWorkers} / {workplace.requiredWorkers}名</span><span className="text-slate-600">{workplace.progress}%</span></div>
            <div role="progressbar" aria-label={`${workplace.projectName}の配置率`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressWidth} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${workplace.status === "attention" ? "bg-amber-500" : "bg-blue-700"}`} style={{ width: `${progressWidth}%` }} /></div>
            {workplace.shortage > 0 && <p className="mt-2 text-xs font-medium text-red-700">不足 {workplace.shortage}名</p>}
          </div>
          <div className="flex items-center justify-between gap-4 lg:justify-end"><span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${workplace.status === "attention" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{workplace.status === "attention" ? "要確認" : "正常"}</span><span aria-hidden="true" className="text-slate-400">›</span></div>
        </div>
      </Link>
    </li>
  );
}
