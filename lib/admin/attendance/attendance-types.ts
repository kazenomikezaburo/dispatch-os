export const ADMIN_ATTENDANCE_STATES = ["scheduled", "start_missing", "working", "finished", "absent", "no_show"] as const;
export type AdminAttendanceState = typeof ADMIN_ATTENDANCE_STATES[number];
export type AttendanceQuery = { date: string; state: "all" | AdminAttendanceState; attention: "all" | "needs_attention"; q: string };
export type AttendanceInput = { id: string; shiftId: string; status: string; workerName: string; startsAt: string; endsAt: string; projectName: string; jobName: string; workplaceName: string; startWorkAt: string | null; endWorkAt: string | null };
export type AttendanceItem = AttendanceInput & { state: AdminAttendanceState; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number; needsAttention: boolean };
export type AttendanceSummary = { total: number; scheduled: number; startMissing: number; working: number; finished: number; absent: number; noShow: number };
export type AttendanceData = { items: AttendanceItem[]; totalAssignments: number; summary: AttendanceSummary };
export type AttendanceResult = { ok: true; data: AttendanceData } | { ok: false };
