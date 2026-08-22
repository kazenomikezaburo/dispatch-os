import Link from "next/link";
import type { AttendanceItem } from "@/lib/admin/attendance/attendance-types";
import { getAssignmentAbsenceActions } from "@/lib/admin/attendance/attendance-rules";
import { AssignmentAbsenceActions } from "./assignment-absence-actions";
import { AttendanceStatusBadge } from "./attendance-status-badge";

const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });

function Anomalies({ item }: { item: AttendanceItem }) {
  return <div className="flex flex-wrap gap-1.5">
    {item.lateMinutes > 0 && <span className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">遅刻 {item.lateMinutes}分</span>}
    {item.earlyLeaveMinutes > 0 && <span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">早退の可能性 {item.earlyLeaveMinutes}分</span>}
    {item.overtimeMinutes > 0 && <span className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">残業 {item.overtimeMinutes}分</span>}
  </div>;
}

export function AttendanceList({ items }: { items: AttendanceItem[] }) {
  const now = new Date();
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-950">勤怠一覧</h2><p className="text-sm text-slate-600">{items.length}件</p></div>
    <div className="hidden grid-cols-[minmax(8rem,1fr)_7rem_minmax(12rem,1.5fr)_7rem_7rem_minmax(8rem,1fr)_minmax(11rem,1fr)] gap-3 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600 lg:grid"><span>スタッフ</span><span>予定</span><span>案件 / 業務 / 勤務先</span><span>状態</span><span>打刻</span><span>確認事項</span><span>操作</span></div>
    <ul className="divide-y divide-slate-200">{items.map((item) => {
      const actions = getAssignmentAbsenceActions(item, now);
      return <li key={item.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(8rem,1fr)_7rem_minmax(12rem,1.5fr)_7rem_7rem_minmax(8rem,1fr)_minmax(11rem,1fr)] lg:items-center lg:px-5">
        <Link href={`/admin/shifts/${item.shiftId}`} className="font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{item.workerName}</Link>
        <span className="text-sm text-slate-700">{time.format(new Date(item.startsAt))} → {time.format(new Date(item.endsAt))}</span>
        <span><span className="block font-medium text-slate-900">{item.projectName}</span><span className="block text-sm text-slate-600">{item.jobName} / {item.workplaceName}</span></span>
        <AttendanceStatusBadge state={item.state} />
        <span className="text-sm text-slate-700">開始 {item.startWorkAt ? time.format(new Date(item.startWorkAt)) : "—"}<br />終了 {item.endWorkAt ? time.format(new Date(item.endWorkAt)) : "—"}</span>
        <Anomalies item={item} />
        <div className="space-y-2"><Link href={`/admin/attendance/${item.id}`} className="inline-flex min-h-11 items-center rounded border border-blue-300 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-50">勤怠詳細</Link><AssignmentAbsenceActions shiftId={item.shiftId} assignmentId={item.id} workerName={item.workerName} {...actions} /></div>
      </li>;
    })}</ul>
  </section>;
}
