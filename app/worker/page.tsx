import Link from "next/link";
import { requireWorker } from "@/lib/auth/require-worker";
import { getWorkerAssignments } from "@/lib/worker/get-worker-assignment";
import { PreShiftStatusBadge } from "@/components/worker/pre-shift-status-badge";

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const attendanceLabels = { not_started: "勤務開始前", working: "勤務中", finished: "勤務終了" } as const;

export default async function WorkerPage() {
  const profile = await requireWorker();
  const result = await getWorkerAssignments(profile.id);
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10"><h1 className="text-2xl font-semibold text-slate-950">次の勤務</h1>{!result.ok ? <section role="alert" className="mt-5 rounded-xl border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">勤務情報を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></section> : result.assignments.length === 0 ? <p className="mt-5 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">予定されている勤務はありません。</p> : <ul className="mt-5 space-y-4">{result.assignments.map((assignment) => <li key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{day.format(new Date(assignment.startsAt))} {time.format(new Date(assignment.startsAt))}〜{time.format(new Date(assignment.endsAt))}</p><p className="mt-3 text-lg font-semibold text-slate-950">{assignment.workplaceName}</p><p className="mt-1 text-sm text-slate-600">{assignment.projectName} / {assignment.jobName}</p></div><div className="flex flex-col items-end gap-2"><span className="rounded bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800">{attendanceLabels[assignment.attendanceState]}</span><PreShiftStatusBadge state={assignment.confirmationState} /></div></div><Link href={`/worker/assignments/${assignment.id}`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">勤務詳細を見る</Link></li>)}</ul>}</main>;
}
