import { getPreShiftConfirmationOpenAt } from "@/lib/domain/pre-shift-confirmation";
import type { WorkerAssignment } from "@/lib/worker/worker-assignment-types";
import type { HealthStatus } from "@/lib/worker/pre-shift-confirmation-schema";
import { PreShiftConfirmationForm } from "./pre-shift-confirmation-form";
import { PreShiftStatusBadge } from "./pre-shift-status-badge";
import { WorkerAttendanceSection } from "./worker-attendance-section";

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const submitted = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const healthLabels: Record<HealthStatus, string> = { good: "問題ありません", concern: "少し不安があります", unwell: "体調が悪いです" };

export function WorkerAssignmentDetail({ assignment }: { assignment: WorkerAssignment }) {
  const manualUrl = safeHttpUrl(assignment.manualUrl);
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
    <header><p className="text-sm font-semibold text-blue-700">勤務詳細</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">{day.format(new Date(assignment.startsAt))}</h1><p className="mt-1 text-xl font-semibold text-slate-900">{time.format(new Date(assignment.startsAt))}〜{time.format(new Date(assignment.endsAt))}</p><p className="mt-4 text-lg font-semibold text-slate-950">{assignment.workplaceName}</p><p className="mt-1 text-slate-700">{assignment.projectName} / {assignment.jobName}</p></header>
    <WorkerAttendanceSection assignment={assignment} />
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">前日確認</h2><PreShiftStatusBadge state={assignment.confirmationState} /></div><div className="mt-5">{assignment.confirmation ? <dl className="grid gap-4 text-sm"><Item label="勤務">{assignment.confirmation.canWork ? "勤務できます" : "勤務できません"}</Item><Item label="体調">{healthLabels[assignment.confirmation.healthStatus]}</Item><Item label="確認日時">{submitted.format(new Date(assignment.confirmation.submittedAt))}</Item></dl> : assignment.hasStarted ? <p className="text-slate-700">前日確認の受付は終了しました。</p> : assignment.confirmationState === "not_open" ? <p className="text-slate-700">前日確認はまだ受付前です。<br />{submitted.format(getPreShiftConfirmationOpenAt(assignment.startsAt))}から確認できます。</p> : <PreShiftConfirmationForm assignmentId={assignment.id} />}</div></section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-slate-950">勤務情報</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Item label="休憩">{assignment.breakMinutes === null ? "未設定" : `${assignment.breakMinutes}分`}</Item><Item label="時給">{assignment.hourlyWage === null ? "未設定" : `${assignment.hourlyWage.toLocaleString("ja-JP")}円`}</Item><Item label="交通費">{assignment.transportationFeeCap === null ? "未設定" : `上限${assignment.transportationFeeCap.toLocaleString("ja-JP")}円`}</Item>{assignment.description && <Item label="仕事内容">{assignment.description}</Item>}{assignment.dressCode && <Item label="服装">{assignment.dressCode}</Item>}{assignment.requirements && <Item label="応募条件">{assignment.requirements}</Item>}{assignment.mealNotes && <Item label="食事案内">{assignment.mealNotes}</Item>}{assignment.recruitmentNotes && <Item label="募集補足">{assignment.recruitmentNotes}</Item>}{manualUrl && <Item label="業務資料"><a href={manualUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">業務資料を開く</a></Item>}</dl></section>
  </main>;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-900">{children}</dd></div>; }
function safeHttpUrl(value: string | null) { if (!value) return null; try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; } catch { return null; } }
