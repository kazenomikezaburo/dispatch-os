import type { ProjectDetailShift } from "@/lib/admin/projects/project-detail-types";
import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
export function ProjectShiftList({ shifts }: { shifts: ProjectDetailShift[] }) {
  if (!shifts.length) return <p className="mt-4 rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-600">シフトはまだ登録されていません。</p>;
  return <ul aria-label="シフト一覧" className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">{shifts.map((shift) => <li key={shift.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(8rem,.8fr)_minmax(10rem,1fr)_auto] sm:items-center"><div><p className="text-sm font-semibold text-slate-950">{day.format(new Date(shift.startsAt))}</p>{shift.label && <p className="mt-1 text-xs text-slate-500">{shift.label}</p>}</div><div><p className="text-sm font-medium text-slate-800">{time.format(new Date(shift.startsAt))}〜{time.format(new Date(shift.endsAt))}</p><p className="mt-1 text-sm text-slate-600">配置 {shift.assignedWorkers} / 必要 {shift.requiredWorkers}名</p></div><div className="flex flex-wrap gap-2 sm:justify-end"><span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{SHIFT_STATUS_LABELS[shift.status]}</span><span className={`rounded px-2.5 py-1 text-xs font-semibold ${shift.shortage > 0 ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{shift.shortage > 0 ? `${shift.shortage}名不足` : "配置完了"}</span></div></li>)}</ul>;
}
