import type { AdminAttendanceState, AttendanceConfirmationState } from "@/lib/admin/attendance/attendance-types";
import { AdminStatusBadge, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

const attendance = {
  scheduled: ["勤務前", "neutral"], start_missing: ["開始未報告", "danger"], working: ["勤務中", "info"], finished: ["勤務終了", "success"], absent: ["欠勤", "warning"], no_show: ["無断欠勤", "danger"],
} as const;
const confirmation = {
  unconfirmed: ["未確定", "warning"], confirmed: ["確定", "success"], corrected: ["訂正済み", "info"],
} as const;

export function AttendanceStatusBadge({ state }: { state: AdminAttendanceState }) {
  const [label, tone] = attendance[state];
  return <AdminStatusBadge tone={tone as AdminVisualTone}>{label}</AdminStatusBadge>;
}
export function AttendanceConfirmationBadge({ state }: { state: AttendanceConfirmationState }) {
  const [label, tone] = confirmation[state];
  return <AdminStatusBadge tone={tone as AdminVisualTone}>{label}</AdminStatusBadge>;
}
