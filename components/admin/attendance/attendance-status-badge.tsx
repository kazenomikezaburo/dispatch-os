import type { AdminAttendanceState, AttendanceConfirmationState } from "@/lib/admin/attendance/attendance-types";

const attendance = {
  scheduled: ["勤務前", "bg-surface-muted text-foreground-secondary"],
  start_missing: ["開始未報告", "bg-danger-subtle text-danger"],
  working: ["勤務中", "bg-info-subtle text-info"],
  finished: ["勤務終了", "bg-success-subtle text-success"],
  absent: ["欠勤", "bg-warning-subtle text-warning"],
  no_show: ["無断欠勤", "bg-danger-subtle text-danger"],
} as const;
const confirmation = {
  unconfirmed: ["未確定", "border-warning bg-warning-subtle text-warning"],
  confirmed: ["確定", "border-success bg-success-subtle text-success"],
  corrected: ["訂正済み", "border-info bg-info-subtle text-info"],
} as const;

export function AttendanceStatusBadge({ state }: { state: AdminAttendanceState }) {
  const [label, style] = attendance[state];
  return <span className={`inline-flex rounded-control px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}
export function AttendanceConfirmationBadge({ state }: { state: AttendanceConfirmationState }) {
  const [label, style] = confirmation[state];
  return <span className={`inline-flex rounded-control border px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}
