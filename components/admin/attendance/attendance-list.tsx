import Link from "next/link";
import type { AttendanceItem } from "@/lib/admin/attendance/attendance-types";
import { getAssignmentAbsenceActions } from "@/lib/admin/attendance/attendance-rules";
import { AssignmentAbsenceActions } from "./assignment-absence-actions";
import { AttendanceConfirmationBadge, AttendanceStatusBadge } from "./attendance-status-badge";

const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
function Anomalies({ item }: { item: AttendanceItem }) {
  const values = [
    item.lateMinutes > 0 ? `遅刻 ${item.lateMinutes}分` : "",
    item.earlyLeaveMinutes > 0 ? `早退の可能性 ${item.earlyLeaveMinutes}分` : "",
    item.overtimeMinutes > 0 ? `予定超過 ${item.overtimeMinutes}分` : "",
  ].filter(Boolean);
  return <p className="text-xs text-foreground-secondary">{values.length ? values.join(" / ") : "確認事項なし"}</p>;
}
export function AttendanceList({ items, total }: { items: AttendanceItem[]; total: number }) {
  const now = new Date();
  return (
    <section className="overflow-hidden rounded-panel border border-border bg-surface">
      <header className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="font-semibold">勤怠一覧</h2>
        <p className="text-sm text-foreground-muted">{total}件</p>
      </header>
      <div className="hidden grid-cols-[minmax(8rem,1fr)_7rem_minmax(12rem,1.5fr)_9rem_8rem_minmax(8rem,1fr)_minmax(10rem,1fr)] gap-3 border-b border-border bg-surface-subtle px-5 py-3 text-xs font-semibold text-foreground-muted lg:grid">
        <span>スタッフ</span><span>勤務予定</span><span>案件 / 業務 / 勤務先</span><span>状態</span><span>打刻</span><span>確認事項</span><span>操作</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const actions = getAssignmentAbsenceActions(item, now);
          return (
            <li key={item.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(8rem,1fr)_7rem_minmax(12rem,1.5fr)_9rem_8rem_minmax(8rem,1fr)_minmax(10rem,1fr)] lg:items-center lg:px-5">
              <div>
                <Link href={`/admin/attendance/${item.id}`} className="inline-flex min-h-11 items-center font-semibold text-link hover:text-link-hover hover:underline focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-focus-ring">{item.workerName}</Link>
                <span className="block text-xs text-foreground-muted lg:hidden">勤怠詳細</span>
              </div>
              <Link href={`/admin/shifts/${item.shiftId}`} className="inline-flex min-h-11 items-center text-sm font-medium text-link hover:text-link-hover hover:underline" aria-label={`${item.workerName}のシフト詳細`}>{time.format(new Date(item.startsAt))}–{time.format(new Date(item.endsAt))}</Link>
              <div><p className="font-medium">{item.projectName}</p><p className="text-sm text-foreground-secondary">{item.jobName} / {item.workplaceName}</p></div>
              <div className="flex flex-wrap gap-1.5"><AttendanceStatusBadge state={item.state} /><AttendanceConfirmationBadge state={item.confirmationState} /></div>
              <p className="text-sm text-foreground-secondary">開始 {item.startWorkAt ? time.format(new Date(item.startWorkAt)) : "—"}<br />終了 {item.endWorkAt ? time.format(new Date(item.endWorkAt)) : "—"}</p>
              <Anomalies item={item} />
              <AssignmentAbsenceActions shiftId={item.shiftId} assignmentId={item.id} workerName={item.workerName} {...actions} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
