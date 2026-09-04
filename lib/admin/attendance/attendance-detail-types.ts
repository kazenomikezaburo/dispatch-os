export type AttendanceDetail = {
  assignmentId: string; shiftId: string; assignmentStatus: string;
  workerId: string; workerName: string; projectId: string; projectName: string; jobName: string; workplaceName: string;
  plannedStartAt: string; plannedEndAt: string; plannedBreakMinutes: number;
  startWorkAt: string | null; endWorkAt: string | null;
  record: null | { id: string; actualStartAt: string; actualEndAt: string; breakMinutes: number; status: string; approvedAt: string; approvedByName: string; adjustmentReason: string | null };
  revisions: Array<{ id: string; beforeActualStartAt: string; beforeActualEndAt: string; beforeBreakMinutes: number; afterActualStartAt: string; afterActualEndAt: string; afterBreakMinutes: number; reason: string; changedAt: string; changedByName: string }>;
  events: Array<{ eventType: string; occurredAt: string | null; receivedAt: string; source: string }>;
};
export type AttendanceDetailResult = { ok: true; detail: AttendanceDetail } | { ok: false; reason: "not_found" | "error" };
