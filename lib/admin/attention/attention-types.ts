export type AttentionType =
  | "staffing_shortage"
  | "placement_conflict"
  | "pre_confirmation_overdue"
  | "day_of_arrival"
  | "open_sos"
  | "attendance_needs_review";

export type AttentionSeverity = "critical" | "high" | "medium";

type AttentionBase = {
  id: string;
  type: AttentionType;
  severity: AttentionSeverity;
  shiftId: string;
  assignmentId: string | null;
  projectId: string;
  projectName: string;
  target: string;
  title: string;
  description: string;
  startsAt: string;
  occurredAt: string;
  destination: string;
  actionLabel: string;
};

export type AttentionItem = AttentionBase & (
  | { type: "staffing_shortage"; reason: "unassigned" | "shortage" }
  | { type: "placement_conflict"; reason: "coverage_shortage" }
  | { type: "pre_confirmation_overdue"; reason: "pending" }
  | { type: "day_of_arrival"; reason: "no_show" | "start_missing" | "late" }
  | { type: "open_sos"; reason: "open" }
  | { type: "attendance_needs_review"; reason: "unconfirmed" }
);

export type AttentionSummary = {
  total: number;
  urgent: number;
  staffing: number;
  confirmation: number;
  dayOf: number;
};

export type AttentionData = {
  items: AttentionItem[];
  summary: AttentionSummary;
  window: { from: string; to: string };
};

export type AttentionResult = { ok: true; data: AttentionData } | { ok: false };

