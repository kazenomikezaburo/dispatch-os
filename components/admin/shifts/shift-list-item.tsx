import type { ShiftListItem as ShiftItem } from "@/lib/admin/shifts/shift-list-types";
import Link from "next/link";
import { ShiftStatusBadge } from "./shift-status-badge";
import { StaffingStatusBadge } from "./staffing-status-badge";

const date = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });

export function ShiftListItem({ shift }: { shift: ShiftItem }) {
  return <li className="grid gap-3 border-t border-slate-200 p-4 first:border-t-0 md:grid-cols-[6rem_7rem_minmax(12rem,1.5fr)_minmax(8rem,1fr)_repeat(4,3.5rem)_minmax(9rem,auto)] md:items-center md:px-5">
    <div><span className="text-xs text-slate-500 md:hidden">勤務日</span><p className="font-semibold"><Link href={`/admin/shifts/${shift.id}`} className="inline-flex min-h-10 items-center text-blue-800 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{date.format(new Date(shift.startsAt))}</Link></p></div>
    <div><span className="text-xs text-slate-500 md:hidden">時間</span><p className="text-sm font-medium text-slate-800">{time.format(new Date(shift.startsAt))}〜{time.format(new Date(shift.endsAt))}</p></div>
    <div><p className="font-semibold text-slate-950">{shift.projectName}</p><p className="mt-1 text-sm text-slate-600">{shift.jobName}</p></div>
    <div><span className="text-xs text-slate-500 md:hidden">勤務先</span><p className="text-sm text-slate-700">{shift.workplaceName}</p></div>
    <dl className="grid grid-cols-4 gap-3 md:contents"><Metric label="必要" value={shift.requiredWorkers} /><Metric label="応募" value={shift.applicationCount} /><Metric label="配置" value={shift.assignedWorkers} /><Metric label="不足" value={shift.shortage} attention={shift.shortage > 0} /></dl>
    <div className="flex flex-wrap items-center gap-2 md:justify-end"><ShiftStatusBadge status={shift.status} /><StaffingStatusBadge staffingState={shift.staffingState} shortage={shift.shortage} /></div>
  </li>;
}

function Metric({ label, value, attention }: { label: string; value: number; attention?: boolean }) {
  return <div><dt className="text-xs text-slate-500 md:sr-only">{label}</dt><dd className={`text-sm font-semibold ${attention ? "text-red-700" : "text-slate-950"}`}>{value}<span className="ml-0.5 text-xs font-normal text-slate-500">名</span></dd></div>;
}
