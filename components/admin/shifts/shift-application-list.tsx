import type { ShiftDetailApplication } from "@/lib/admin/shifts/shift-detail-types";
import { ApplicationStatusBadge } from "./application-status-badge";
import { ApplicationActionButtons } from "./application-action-buttons";
import { AssignmentActionButton } from "./assignment-action-button";
import { Section } from "./shift-info-section";

const appliedAt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export function ShiftApplicationList({ shiftId, applications, assignedWorkers, requiredWorkers }: { shiftId: string; applications: ShiftDetailApplication[]; assignedWorkers: number; requiredWorkers: number }) {
  const hasCapacity = assignedWorkers < requiredWorkers;
  return <Section title={`応募者 ${applications.length}名`}>{applications.length === 0 ? <p className="rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-600">まだ応募者はいません。</p> : <ul className="divide-y divide-slate-200">{applications.map((application) => <li key={application.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-950">{application.workerName}</p><p className="mt-1 text-sm text-slate-500">応募日時 {appliedAt.format(new Date(application.appliedAt))}</p><div className="mt-2 flex flex-wrap gap-2"><ApplicationStatusBadge status={application.status} />{application.assigned && <span className="inline-flex rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">配置済み</span>}{application.status === "accepted" && !application.assigned && !hasCapacity && <span className="inline-flex rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">募集人数充足</span>}</div></div>{application.status === "applied" && !application.assigned && <ApplicationActionButtons shiftId={shiftId} applicationId={application.id} workerName={application.workerName} />}{application.status === "accepted" && !application.assigned && hasCapacity && <AssignmentActionButton shiftId={shiftId} applicationId={application.id} workerName={application.workerName} />}</li>)}</ul>}</Section>;
}
