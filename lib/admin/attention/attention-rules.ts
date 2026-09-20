import type { AttentionData, AttentionItem, AttentionSummary } from "./attention-types.ts";

export type StaffingAttentionSource = {
  shiftId: string; projectId: string; projectName: string; jobName: string; workplaceName: string;
  startsAt: string; requiredWorkers: number; assignedWorkers: number; staffingState: "unassigned" | "shortage" | "filled";
};
export type PlacementAttentionSource = {
  planId: string; positionId: string; positionLabel: string; shiftId: string; projectId: string; projectName: string;
  jobName: string; workplaceName: string; startsAt: string; intervalStart: string; intervalEnd: string; shortage: number; current: boolean;
};
export type PreConfirmationAttentionSource = {
  assignmentId: string; shiftId: string; projectId: string; projectName: string; workerName: string; workplaceName: string;
  startsAt: string; openAt: string; state: "not_open" | "pending" | "confirmed"; beforeStart: boolean;
};
export type DayOfAttentionSource = {
  assignmentId: string; shiftId: string; projectId: string; projectName: string; workerName: string; workplaceName: string;
  startsAt: string; startWorkAt: string | null; state: "scheduled" | "start_missing" | "working" | "finished" | "absent" | "no_show"; lateMinutes: number;
};
export type SosAttentionSource = {
  incidentId: string; assignmentId: string; shiftId: string; projectId: string; projectName: string; workerName: string;
  workplaceName: string; startsAt: string; createdAt: string; state: "open" | "acknowledged" | "resolved" | "retracted";
};
export type AttendanceReviewSource = {
  assignmentId: string; shiftId: string; projectId: string; projectName: string; workerName: string; workplaceName: string;
  startsAt: string; endWorkAt: string | null; state: "scheduled" | "start_missing" | "working" | "finished" | "absent" | "no_show";
  confirmationState: "unconfirmed" | "confirmed" | "corrected";
};

export type AttentionSources = {
  staffing: StaffingAttentionSource[];
  placement: PlacementAttentionSource[];
  preConfirmations: PreConfirmationAttentionSource[];
  dayOf: DayOfAttentionSource[];
  incidents: SosAttentionSource[];
  attendanceReviews: AttendanceReviewSource[];
};

const severityRank = { critical: 0, high: 1, medium: 2 } as const;
const typeRank: Record<AttentionItem["type"], number> = {
  open_sos: 0,
  day_of_arrival: 1,
  staffing_shortage: 2,
  placement_conflict: 3,
  pre_confirmation_overdue: 4,
  attendance_needs_review: 5,
};
const encode = encodeURIComponent;

export function buildAttentionData(sources: AttentionSources, window: AttentionData["window"]): AttentionData {
  const items: AttentionItem[] = [];

  for (const source of sources.incidents) {
    if (source.state !== "open") continue;
    items.push({ id:`open_sos:${source.incidentId}`,type:"open_sos",reason:"open",severity:"critical",shiftId:source.shiftId,assignmentId:source.assignmentId,projectId:source.projectId,projectName:source.projectName,target:`${source.projectName} / ${source.workplaceName}`,title:`${source.workerName}さんからSOSがあります`,description:"現場から支援要請",startsAt:source.startsAt,occurredAt:source.createdAt,destination:`/admin/incidents?state=unresolved&incident=${encode(source.incidentId)}`,actionLabel:"対応する" });
  }
  for (const source of sources.dayOf) {
    const reason = source.state === "no_show" ? "no_show" : source.state === "start_missing" ? "start_missing" : source.lateMinutes > 0 ? "late" : null;
    if (!reason) continue;
    const severity = reason === "late" ? "medium" : "critical";
    const title = reason === "no_show" ? `${source.workerName}さんが無断欠勤です` : reason === "start_missing" ? `${source.workerName}さんの勤務開始報告がありません` : `${source.workerName}さんが${source.lateMinutes}分遅れて開始しました`;
    items.push({ id:`day_of_arrival:${source.assignmentId}`,type:"day_of_arrival",reason,severity,shiftId:source.shiftId,assignmentId:source.assignmentId,projectId:source.projectId,projectName:source.projectName,target:`${source.projectName} / ${source.workplaceName}`,title,description:reason === "late" ? `開始 ${source.lateMinutes}分遅れ` : "当日の勤務状態を確認してください",startsAt:source.startsAt,occurredAt:source.startWorkAt ?? source.startsAt,destination:`/admin/shifts/${encode(source.shiftId)}?tab=confirmation&phase=day&assignmentId=${encode(source.assignmentId)}`,actionLabel:"確認する" });
  }
  for (const source of sources.staffing) {
    if (source.staffingState === "filled") continue;
    const shortage = Math.max(source.requiredWorkers - source.assignedWorkers, 0);
    items.push({ id:`staffing_shortage:${source.shiftId}`,type:"staffing_shortage",reason:source.staffingState,severity:"high",shiftId:source.shiftId,assignmentId:null,projectId:source.projectId,projectName:source.projectName,target:`${source.projectName} / ${source.workplaceName}`,title:`${source.jobName}で${shortage}名不足`,description:`必要${source.requiredWorkers}名 / 配置${source.assignedWorkers}名`,startsAt:source.startsAt,occurredAt:source.startsAt,destination:`/admin/shifts/${encode(source.shiftId)}?tab=overview`,actionLabel:"シフトを見る" });
  }
  for (const source of sources.placement) {
    if (source.shortage <= 0) continue;
    items.push({ id:`placement_conflict:${source.planId}:${source.positionId}`,type:"placement_conflict",reason:"coverage_shortage",severity:source.current?"high":"medium",shiftId:source.shiftId,assignmentId:null,projectId:source.projectId,projectName:source.projectName,target:`${source.projectName} / ${source.workplaceName}`,title:`${source.positionLabel}の配置が${source.shortage}名不足`,description:`${clock(source.intervalStart)}〜${clock(source.intervalEnd)} のCoverage不足`,startsAt:source.startsAt,occurredAt:source.intervalStart,destination:`/admin/shifts/${encode(source.shiftId)}?tab=placement`,actionLabel:"配置を見る" });
  }
  for (const source of sources.preConfirmations) {
    if (source.state !== "pending" || !source.beforeStart) continue;
    items.push({ id:`pre_confirmation_overdue:${source.assignmentId}`,type:"pre_confirmation_overdue",reason:"pending",severity:"high",shiftId:source.shiftId,assignmentId:source.assignmentId,projectId:source.projectId,projectName:source.projectName,target:`${source.workerName} / ${source.projectName}`,title:`${source.workerName}さんの前日確認が未回答です`,description:`${source.workplaceName} / ${dateTime(source.startsAt)}`,startsAt:source.startsAt,occurredAt:source.openAt,destination:`/admin/shifts/${encode(source.shiftId)}?tab=confirmation&phase=pre&assignmentId=${encode(source.assignmentId)}`,actionLabel:"確認を見る" });
  }
  for (const source of sources.attendanceReviews) {
    if (source.state !== "finished" || source.confirmationState !== "unconfirmed" || !source.endWorkAt) continue;
    items.push({ id:`attendance_needs_review:${source.assignmentId}`,type:"attendance_needs_review",reason:"unconfirmed",severity:"high",shiftId:source.shiftId,assignmentId:source.assignmentId,projectId:source.projectId,projectName:source.projectName,target:`${source.workerName} / ${source.projectName}`,title:`${source.workerName}さんの勤怠が未確定です`,description:`${source.workplaceName} / 勤務終了`,startsAt:source.startsAt,occurredAt:source.endWorkAt,destination:`/admin/attendance/${encode(source.assignmentId)}`,actionLabel:"勤怠を確認" });
  }

  items.sort(compareAttention);
  return { items, summary: summarizeAttention(items), window };
}

export function compareAttention(left: AttentionItem, right: AttentionItem) {
  return severityRank[left.severity] - severityRank[right.severity]
    || typeRank[left.type] - typeRank[right.type]
    || left.occurredAt.localeCompare(right.occurredAt)
    || left.id.localeCompare(right.id);
}

export function summarizeAttention(items: AttentionItem[]): AttentionSummary {
  return {
    total: items.length,
    urgent: items.filter((item) => item.type === "open_sos").length,
    staffing: items.filter((item) => item.type === "staffing_shortage" || item.type === "placement_conflict").length,
    confirmation: items.filter((item) => item.type === "pre_confirmation_overdue" || item.type === "attendance_needs_review").length,
    dayOf: items.filter((item) => item.type === "day_of_arrival").length,
  };
}

function clock(value: string) { return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value)); }
