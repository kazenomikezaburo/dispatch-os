import Link from "next/link";
import { requireWorker } from "@/lib/auth/require-worker";
import { getWorkerAssignments } from "@/lib/worker/get-worker-assignment";
import { PreShiftStatusBadge } from "@/components/worker/pre-shift-status-badge";
import { WorkerJourneyActionButton } from "@/components/worker/worker-journey-action-button";
import { deriveWorkerAssignmentGroup, type JourneyType, type WorkerAssignmentGroup } from "@/lib/worker/journey/worker-journey";
import type { WorkerAssignment } from "@/lib/worker/worker-assignment-types";

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const attendanceLabels = { not_started: "勤務開始前", working: "勤務中", finished: "勤務終了" } as const;

const nextStateLabels = { not_open: "受付前", actionable: "対応できます", overdue: "対応が必要です" } as const;
const groupLabels: Record<WorkerAssignmentGroup, string> = { current: "勤務中", upcoming: "これからの勤務", past: "完了・過去の勤務", terminal: "取消・終了した勤務" };
const assignmentLabels: Record<WorkerAssignment["assignmentStatus"], string> = { assigned: "アサイン済み", confirmed: "確定", completed: "完了", cancelled_by_worker: "本人取消", cancelled_by_company: "会社取消", absent: "欠勤", no_show: "無断欠勤" };

export default async function WorkerPage() {
  const profile = await requireWorker();
  const result = await getWorkerAssignments(profile.id);
  if (!result.ok) return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10"><h1 className="text-2xl font-semibold text-slate-950">My Shifts</h1><section role="alert" className="mt-5 rounded-xl border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">勤務情報を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></section></main>;
  const groups = new Map<WorkerAssignmentGroup, WorkerAssignment[]>([["current", []], ["upcoming", []], ["past", []], ["terminal", []]]);
  for (const assignment of result.assignments) groups.get(deriveWorkerAssignmentGroup({ assignmentStatus: assignment.assignmentStatus, shiftStatus: assignment.shiftStatus, startsAt: assignment.startsAt, endsAt: assignment.endsAt, generatedAt: assignment.timeline.generatedAt }))?.push(assignment);
  for (const group of ["past", "terminal"] as const) groups.get(group)?.sort((a, b) => b.startsAt.localeCompare(a.startsAt) || a.id.localeCompare(b.id));
  const primary = result.assignments.find((assignment) => { const group = deriveWorkerAssignmentGroup({ assignmentStatus: assignment.assignmentStatus, shiftStatus: assignment.shiftStatus, startsAt: assignment.startsAt, endsAt: assignment.endsAt, generatedAt: assignment.timeline.generatedAt }); return group === "current" || group === "upcoming"; });
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10"><header><p className="text-sm font-semibold text-blue-700">Worker</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">My Shifts</h1><p className="mt-2 text-sm text-slate-600">次に必要なActionと、これまでの勤務を確認できます。</p></header>{result.assignments.length === 0 ? <p className="mt-5 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">勤務はありません。</p> : (["current", "upcoming", "past", "terminal"] as const).map((group) => { const assignments = groups.get(group) ?? []; if (!assignments.length) return null; return <section key={group} className="mt-8" aria-labelledby={`shift-group-${group}`}><h2 id={`shift-group-${group}`} className="text-lg font-semibold text-slate-950">{groupLabels[group]}</h2><ul className="mt-4 space-y-4">{assignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} primary={assignment.id === primary?.id} />)}</ul></section>; })}</main>;
}

function AssignmentCard({ assignment, primary }: { assignment: WorkerAssignment; primary: boolean }) {
  const nextAction = assignment.timeline.nextAction;
  const journeyType: JourneyType | null = nextAction?.kind === "wake" || nextAction?.kind === "departure" || nextAction?.kind === "arrival" ? nextAction.kind : null;
  const canRecord = primary && journeyType && nextAction && nextAction.state !== "not_open";
  return <li className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{day.format(new Date(assignment.startsAt))} {time.format(new Date(assignment.startsAt))}〜{time.format(new Date(assignment.endsAt))}</p><p className="mt-3 text-lg font-semibold text-slate-950">{assignment.workplaceName}</p><p className="mt-1 text-sm text-slate-600">{assignment.projectName} / {assignment.jobName}</p></div><div className="flex flex-col items-end gap-2"><span className="rounded bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800">{assignmentLabels[assignment.assignmentStatus]}</span><span className="rounded bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800">{attendanceLabels[assignment.attendanceState]}</span><PreShiftStatusBadge state={assignment.confirmationState} /></div></div>{nextAction && <div className={`mt-4 rounded-lg border p-3 ${primary ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xs font-semibold text-slate-600">{primary ? "今対応するAction" : "次のAction"}</p><p className="mt-1 font-semibold text-slate-950">{nextAction.label}</p><p className="mt-1 text-sm text-slate-600">{nextStateLabels[nextAction.state]}</p>{canRecord && <WorkerJourneyActionButton assignmentId={assignment.id} journeyType={journeyType} compact />}</div>}<Link href={`/worker/assignments/${assignment.id}`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-blue-700 bg-white px-5 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">勤務詳細を見る</Link></li>;
}
