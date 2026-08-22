export type AttendanceDetail = {
  assignmentId: string; shiftId: string; assignmentStatus: string;
  workerName: string; projectName: string; jobName: string; workplaceName: string;
  plannedStartAt: string; plannedEndAt: string; plannedBreakMinutes: number;
  startWorkAt: string | null; endWorkAt: string | null;
  record: null | { id: string; actualStartAt: string; actualEndAt: string; breakMinutes: number; status: string; approvedAt: string; approvedByName: string; adjustmentReason: string | null };
  revisions: Array<{ id: string; beforeActualStartAt: string; beforeActualEndAt: string; beforeBreakMinutes: number; afterActualStartAt: string; afterActualEndAt: string; afterBreakMinutes: number; reason: string; changedAt: string; changedByName: string }>;
};
export type AttendanceDetailResult = { ok: true; detail: AttendanceDetail } | { ok: false; reason: "not_found" | "error" };
