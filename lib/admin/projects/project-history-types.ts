export const PROJECT_HISTORY_EVENT_TYPES = [
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_STATUS_CHANGED",
  "JOB_CREATED",
  "JOB_UPDATED",
  "JOB_STATUS_CHANGED",
  "JOB_WORKPLACE_CHANGED",
  "SHIFT_CREATED",
  "SHIFT_UPDATED",
  "SHIFT_STATUS_CHANGED",
  "PROJECT_CONTEXT_WORKPLACE_UPDATED",
] as const;

export type ProjectHistoryEventType = (typeof PROJECT_HISTORY_EVENT_TYPES)[number];
export type ProjectHistoryTargetType = "project" | "job" | "shift" | "workplace";

export type ProjectHistoryEvent = {
  id: number;
  createdAt: string;
  actorDisplayName: string;
  eventType: ProjectHistoryEventType;
  targetType: ProjectHistoryTargetType;
  targetId: string;
  targetLabel: string;
  payload: Record<string, unknown>;
};

export type ProjectHistoryCursor = {
  createdAt: string;
  id: number;
};

export type ProjectHistoryPage = {
  items: ProjectHistoryEvent[];
  nextCursor: ProjectHistoryCursor | null;
};
