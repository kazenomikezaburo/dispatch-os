import type { AdminAttendanceState, AttendanceData, AttendanceInput, AttendanceItem, AttendanceQuery, AttendanceSummary } from "./attendance-types.ts";

const minute = 60_000;
export function getAssignmentAbsenceActions(input: Pick<AttendanceInput, "status" | "startsAt" | "startWorkAt">, now: Date) {
  const canMarkAbsent = (input.status === "assigned" || input.status === "confirmed") && input.startWorkAt === null;
  return { canMarkAbsent, canMarkNoShow: canMarkAbsent && now.getTime() >= new Date(input.startsAt).getTime() };
}
function positiveMinutes(milliseconds: number) { return milliseconds > 0 ? Math.ceil(milliseconds / minute) : 0; }
export function deriveAdminAttendance(input: AttendanceInput, now: Date): AttendanceItem {
  let state: AdminAttendanceState;
  if (input.status === "absent") state = "absent";
  else if (input.status === "no_show") state = "no_show";
  else if (input.endWorkAt && !input.startWorkAt) throw new Error("Invalid attendance event order");
  else if (input.startWorkAt && input.endWorkAt) state = "finished";
  else if (input.startWorkAt) state = "working";
  else state = now.getTime() >= new Date(input.startsAt).getTime() ? "start_missing" : "scheduled";
  const lateMinutes = input.startWorkAt ? positiveMinutes(new Date(input.startWorkAt).getTime() - new Date(input.startsAt).getTime()) : 0;
  const earlyLeaveMinutes = input.endWorkAt ? positiveMinutes(new Date(input.endsAt).getTime() - new Date(input.endWorkAt).getTime()) : 0;
  const overtimeMinutes = input.endWorkAt ? positiveMinutes(new Date(input.endWorkAt).getTime() - new Date(input.endsAt).getTime()) : 0;
  return { ...input, state, lateMinutes, earlyLeaveMinutes, overtimeMinutes, needsAttention: state === "start_missing" || state === "absent" || state === "no_show" || lateMinutes > 0 || earlyLeaveMinutes > 0 };
}
const priority: Record<AdminAttendanceState, number> = { no_show: 0, absent: 1, start_missing: 2, working: 5, scheduled: 6, finished: 7 };
function itemPriority(item: AttendanceItem) { if (item.state === "working" && item.lateMinutes > 0) return 3; if (item.state === "finished" && item.earlyLeaveMinutes > 0) return 4; return priority[item.state]; }
export function buildAttendanceData(inputs: AttendanceInput[], query: AttendanceQuery, now: Date): AttendanceData {
  const all = inputs.map((input) => deriveAdminAttendance(input, now));
  const summary: AttendanceSummary = { total: all.length, scheduled: 0, startMissing: 0, working: 0, finished: 0, absent: 0, noShow: 0 };
  for (const item of all) { if (item.state === "scheduled") summary.scheduled++; else if (item.state === "start_missing") summary.startMissing++; else if (item.state === "working") summary.working++; else if (item.state === "finished") summary.finished++; else if (item.state === "absent") summary.absent++; else summary.noShow++; }
  const needle = query.q.toLocaleLowerCase("ja");
  const items = all.filter((item) => (query.state === "all" || item.state === query.state) && (query.attention === "all" || item.needsAttention) && (needle === "" || [item.workerName, item.projectName, item.jobName, item.workplaceName].some((value) => value.toLocaleLowerCase("ja").includes(needle))));
  items.sort((a, b) => itemPriority(a) - itemPriority(b) || a.startsAt.localeCompare(b.startsAt) || a.workerName.localeCompare(b.workerName, "ja") || a.id.localeCompare(b.id));
  return { items, totalAssignments: all.length, summary };
}
