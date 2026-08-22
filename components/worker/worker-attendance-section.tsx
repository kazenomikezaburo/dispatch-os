import type { WorkerAssignment } from "@/lib/worker/worker-assignment-types";
import { AttendanceActionButton } from "./attendance-action-button";

const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const labels = { not_started: "勤務開始前", working: "勤務中", finished: "勤務終了" } as const;

export function WorkerAttendanceSection({ assignment }: { assignment: WorkerAssignment }) {
  const opensAt = new Date(assignment.startsAt).getTime() - 60 * 60 * 1000;

  return <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-slate-950">勤怠</h2>
      <span className="inline-flex rounded bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800">{labels[assignment.attendanceState]}</span>
    </div>
    <dl className="mt-5 grid gap-4 text-sm">
      <div><dt className="text-xs font-semibold text-slate-500">開始予定</dt><dd className="mt-1 text-slate-900">{time.format(new Date(assignment.startsAt))}</dd></div>
      {assignment.startWorkAt && <div><dt className="text-xs font-semibold text-slate-500">勤務開始</dt><dd className="mt-1 text-slate-900">{time.format(new Date(assignment.startWorkAt))}</dd></div>}
      {assignment.endWorkAt && <div><dt className="text-xs font-semibold text-slate-500">勤務終了</dt><dd className="mt-1 text-slate-900">{time.format(new Date(assignment.endWorkAt))}</dd></div>}
    </dl>
    <div className="mt-5">
      {assignment.canEndWork ? <AttendanceActionButton assignmentId={assignment.id} kind="end" /> : assignment.canStartWork ? <AttendanceActionButton assignmentId={assignment.id} kind="start" /> : assignment.attendanceState === "not_started" && !assignment.hasStarted ? <p className="text-slate-700">打刻受付前です。勤務開始の打刻は{time.format(new Date(opensAt))}からできます。</p> : assignment.attendanceState === "not_started" ? <p className="text-slate-700">現在は勤務開始を打刻できません。</p> : null}
    </div>
  </section>;
}
