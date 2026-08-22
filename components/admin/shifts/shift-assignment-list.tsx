import type { ShiftDetailAssignment } from "@/lib/admin/shifts/shift-detail-types";
import { AssignmentCancelButton } from "./assignment-cancel-button";
import { AssignmentStatusBadge } from "./assignment-status-badge";
import { Section } from "./shift-info-section";
import { AssignmentAbsenceActions } from "@/components/admin/attendance/assignment-absence-actions";
import { getAssignmentAbsenceActions } from "@/lib/admin/attendance/attendance-rules";

export function ShiftAssignmentList({
  shiftId,
  startsAt,
  assignments,
}: {
  shiftId: string;
  startsAt: string;
  assignments: ShiftDetailAssignment[];
}) {
  const now = new Date();
  return <Section title={`配置済みスタッフ ${assignments.length}名`}>{assignments.length === 0 ? <p className="rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-600">まだスタッフは配置されていません。</p> : <ul className="divide-y divide-slate-200">{assignments.map((assignment) => {
    const actions = getAssignmentAbsenceActions({ status: assignment.status, startsAt, startWorkAt: assignment.startWorkAt ?? null }, now);
    return <li key={assignment.id} className="flex min-h-14 flex-col justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"><div><p className="font-semibold text-slate-950">{assignment.workerName}</p><div className="mt-2"><AssignmentStatusBadge status={assignment.status} /></div></div><div className="flex flex-col gap-2 sm:items-end">{(assignment.status === "assigned" || assignment.status === "confirmed") && <AssignmentCancelButton shiftId={shiftId} assignmentId={assignment.id} workerName={assignment.workerName} startsAt={startsAt} />}<AssignmentAbsenceActions shiftId={shiftId} assignmentId={assignment.id} workerName={assignment.workerName} {...actions} /></div></li>;
  })}</ul>}</Section>;
}
