export const JOURNEY_TYPES = ["wake", "departure", "arrival"] as const;
export type JourneyType = (typeof JOURNEY_TYPES)[number];
export type JourneyState = "not_required" | "scheduled" | "not_open" | "actionable" | "overdue" | "completed" | "completed_late" | "missing_superseded" | "closed";
export type JourneyActionKind = "pre_shift_confirmation" | JourneyType;
export type JourneyActionState = "not_open" | "actionable" | "overdue";

export type WorkerJourneyFact = {
  operation: "recorded" | "voided" | null;
  occurredAt: string | null;
  timeliness: "early_or_on_time" | "late" | null;
};

export type WorkerJourneyFacts = {
  assignmentId: string;
  shiftId: string;
  generatedAt: string;
  assignmentStatus: string;
  shiftStatus: string;
  startsAt: string;
  endsAt: string;
  arrivalTarget: string;
  hasConfirmation: boolean;
  confirmationSubmittedAt: string | null;
  plannedWakeAt: string | null;
  plannedDepartureAt: string | null;
  wake: WorkerJourneyFact;
  departure: WorkerJourneyFact;
  arrival: WorkerJourneyFact;
  startWorkAt: string | null;
  endWorkAt: string | null;
  placementLabels: string[];
};

export type WorkerJourneyCurrentState = {
  type: JourneyType;
  state: JourneyState;
  dueAt: string | null;
  occurredAt: string | null;
};

export type WorkerNextAction = {
  kind: JourneyActionKind;
  state: JourneyActionState;
  dueAt: string | null;
  href: string;
  label: string;
};

export type ShiftTimelineItem = {
  id: string;
  type: "assignment_confirmed" | "placement_context" | "pre_shift_confirmation" | JourneyType | "attendance_start" | "attendance_end" | "incident_created" | "incident_acknowledged" | "incident_resolved" | "incident_retracted" | "assignment_cancelled" | "assignment_completed";
  occurredAt: string | null;
  effectiveAt: string | null;
  state: "scheduled" | "not_open" | "actionable" | "overdue" | "completed" | "completed_late" | "missing_superseded" | "cancelled" | "unavailable";
  actorCategory: "worker" | "manager" | "system" | "derived" | null;
  sourceCategory: "assignment" | "placement" | "confirmation" | "journey" | "attendance" | "incident";
  label: string;
  actionable: boolean;
  action: null | { kind: JourneyActionKind; href: string };
  sourceAvailable: boolean;
  navigationTarget: string | null;
};

export type WorkerTimelineIncident = {
  id: string;
  state: "open" | "acknowledged" | "resolved" | "retracted";
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  retractedAt: string | null;
};

export type ShiftTimelineProjection = {
  assignmentId: string;
  shiftId: string;
  timeZone: "Asia/Tokyo";
  generatedAt: string;
  current: Record<JourneyType, WorkerJourneyCurrentState>;
  items: ShiftTimelineItem[];
  nextAction: WorkerNextAction | null;
};

const ACTIVE_ASSIGNMENTS = new Set(["assigned", "confirmed"]);
const actionLabels: Record<JourneyActionKind, string> = {
  pre_shift_confirmation: "前日確認を行う",
  wake: "起床を報告する",
  departure: "出発を報告する",
  arrival: "到着を報告する",
};
const journeyLabels: Record<JourneyType, string> = { wake: "起床", departure: "出発", arrival: "到着" };
const rank: Record<ShiftTimelineItem["type"], number> = {
  assignment_confirmed: 10,
  placement_context: 20,
  pre_shift_confirmation: 30,
  wake: 40,
  departure: 50,
  arrival: 60,
  attendance_start: 70,
  incident_created: 80,
  incident_acknowledged: 81,
  incident_resolved: 82,
  incident_retracted: 83,
  attendance_end: 90,
  assignment_cancelled: 100,
  assignment_completed: 101,
};

function confirmationOpenAt(startsAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(startsAt));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day") - 1) - 9 * 60 * 60 * 1000).toISOString();
}

function scheduleFor(facts: WorkerJourneyFacts, type: JourneyType) {
  if (type === "wake") return facts.plannedWakeAt ? { dueAt: facts.plannedWakeAt, openMs: 6 * 60 * 60 * 1000, overdueMs: 15 * 60 * 1000 } : null;
  if (type === "departure") return facts.plannedDepartureAt ? { dueAt: facts.plannedDepartureAt, openMs: 2 * 60 * 60 * 1000, overdueMs: 10 * 60 * 1000 } : null;
  return { dueAt: facts.arrivalTarget, openMs: 3 * 60 * 60 * 1000, overdueMs: 5 * 60 * 1000 };
}

export function deriveJourneyState(facts: WorkerJourneyFacts, type: JourneyType): WorkerJourneyCurrentState {
  const fact = facts[type];
  const schedule = scheduleFor(facts, type);
  if (fact.operation === "recorded" && fact.occurredAt) return { type, state: fact.timeliness === "late" ? "completed_late" : "completed", dueAt: schedule?.dueAt ?? null, occurredAt: fact.occurredAt };
  if (!schedule) return { type, state: "not_required", dueAt: null, occurredAt: null };
  const terminal = !ACTIVE_ASSIGNMENTS.has(facts.assignmentStatus) || facts.shiftStatus === "cancelled" || new Date(facts.generatedAt).getTime() >= new Date(facts.endsAt).getTime();
  if (terminal) return { type, state: "closed", dueAt: schedule.dueAt, occurredAt: null };
  const superseded = type === "arrival" ? Boolean(facts.startWorkAt) : Boolean(facts.startWorkAt || facts.arrival.operation === "recorded");
  if (superseded) return { type, state: "missing_superseded", dueAt: schedule.dueAt, occurredAt: null };
  if (!facts.hasConfirmation) return { type, state: "scheduled", dueAt: schedule.dueAt, occurredAt: null };
  const now = new Date(facts.generatedAt).getTime();
  const due = new Date(schedule.dueAt).getTime();
  if (now < due - schedule.openMs) return { type, state: "not_open", dueAt: schedule.dueAt, occurredAt: null };
  if (now >= due + schedule.overdueMs) return { type, state: "overdue", dueAt: schedule.dueAt, occurredAt: null };
  return { type, state: "actionable", dueAt: schedule.dueAt, occurredAt: null };
}

function actionFromState(assignmentId: string, current: WorkerJourneyCurrentState): WorkerNextAction | null {
  if (!(["not_open", "actionable", "overdue"] as JourneyState[]).includes(current.state)) return null;
  return { kind: current.type, state: current.state as JourneyActionState, dueAt: current.dueAt, href: `/worker/assignments/${assignmentId}#journey-${current.type}`, label: actionLabels[current.type] };
}

export function deriveNextAction(facts: WorkerJourneyFacts, current: Record<JourneyType, WorkerJourneyCurrentState>): WorkerNextAction | null {
  if (!ACTIVE_ASSIGNMENTS.has(facts.assignmentStatus) || facts.shiftStatus === "cancelled" || new Date(facts.generatedAt).getTime() >= new Date(facts.endsAt).getTime()) return null;
  if (!facts.hasConfirmation) {
    const openAt = confirmationOpenAt(facts.startsAt);
    const state: JourneyActionState = new Date(facts.generatedAt).getTime() < new Date(openAt).getTime() ? "not_open" : "actionable";
    return { kind: "pre_shift_confirmation", state, dueAt: facts.startsAt, href: `/worker/assignments/${facts.assignmentId}#pre-shift-confirmation`, label: actionLabels.pre_shift_confirmation };
  }
  for (const type of JOURNEY_TYPES) {
    const action = actionFromState(facts.assignmentId, current[type]);
    if (action) return action;
  }
  return null;
}

function timelineState(state: JourneyState): ShiftTimelineItem["state"] {
  return state === "not_required" || state === "closed" ? "unavailable" : state;
}

export function buildShiftTimeline(facts: WorkerJourneyFacts, incidents: WorkerTimelineIncident[]): ShiftTimelineProjection {
  const current = Object.fromEntries(JOURNEY_TYPES.map((type) => [type, deriveJourneyState(facts, type)])) as Record<JourneyType, WorkerJourneyCurrentState>;
  const nextAction = deriveNextAction(facts, current);
  const items: ShiftTimelineItem[] = [{ id: "assignment:current", type: "assignment_confirmed", occurredAt: null, effectiveAt: facts.startsAt, state: "scheduled", actorCategory: "derived", sourceCategory: "assignment", label: "勤務が確定しています", actionable: false, action: null, sourceAvailable: true, navigationTarget: null }];
  if (facts.placementLabels.length) items.push({ id: "placement:current", type: "placement_context", occurredAt: null, effectiveAt: facts.startsAt, state: "scheduled", actorCategory: "derived", sourceCategory: "placement", label: `配置: ${facts.placementLabels.join("・")}`, actionable: false, action: null, sourceAvailable: true, navigationTarget: null });
  items.push({ id: "confirmation:current", type: "pre_shift_confirmation", occurredAt: facts.confirmationSubmittedAt, effectiveAt: facts.startsAt, state: facts.hasConfirmation ? "completed" : nextAction?.kind === "pre_shift_confirmation" ? nextAction.state : "unavailable", actorCategory: facts.hasConfirmation ? "worker" : "derived", sourceCategory: "confirmation", label: facts.hasConfirmation ? "前日確認済み" : "前日確認", actionable: nextAction?.kind === "pre_shift_confirmation" && nextAction.state !== "not_open", action: nextAction?.kind === "pre_shift_confirmation" ? { kind: nextAction.kind, href: nextAction.href } : null, sourceAvailable: true, navigationTarget: "#pre-shift-confirmation" });
  for (const type of JOURNEY_TYPES) {
    const value = current[type];
    const action = nextAction?.kind === type ? { kind: type, href: nextAction.href } : null;
    items.push({ id: `journey:${type}:current`, type, occurredAt: value.occurredAt, effectiveAt: value.dueAt, state: timelineState(value.state), actorCategory: value.occurredAt ? "worker" : "derived", sourceCategory: "journey", label: journeyLabels[type], actionable: Boolean(action && nextAction?.state !== "not_open"), action, sourceAvailable: true, navigationTarget: `#journey-${type}` });
  }
  if (facts.startWorkAt) items.push({ id: "attendance:start", type: "attendance_start", occurredAt: facts.startWorkAt, effectiveAt: facts.startsAt, state: "completed", actorCategory: "worker", sourceCategory: "attendance", label: "勤務開始", actionable: false, action: null, sourceAvailable: true, navigationTarget: "#attendance" });
  if (facts.endWorkAt) items.push({ id: "attendance:end", type: "attendance_end", occurredAt: facts.endWorkAt, effectiveAt: facts.endsAt, state: "completed", actorCategory: "worker", sourceCategory: "attendance", label: "勤務終了", actionable: false, action: null, sourceAvailable: true, navigationTarget: "#attendance" });
  for (const incident of incidents) {
    items.push({ id: `incident:${incident.id}:created`, type: "incident_created", occurredAt: incident.createdAt, effectiveAt: null, state: "completed", actorCategory: "worker", sourceCategory: "incident", label: "Help Requestを送信", actionable: false, action: null, sourceAvailable: true, navigationTarget: "#help-request" });
    if (incident.acknowledgedAt) items.push({ id: `incident:${incident.id}:acknowledged`, type: "incident_acknowledged", occurredAt: incident.acknowledgedAt, effectiveAt: null, state: "completed", actorCategory: "manager", sourceCategory: "incident", label: "Help Request対応中", actionable: false, action: null, sourceAvailable: true, navigationTarget: "#help-request" });
    if (incident.resolvedAt) items.push({ id: `incident:${incident.id}:resolved`, type: "incident_resolved", occurredAt: incident.resolvedAt, effectiveAt: null, state: "completed", actorCategory: "manager", sourceCategory: "incident", label: "Help Request解決済み", actionable: false, action: null, sourceAvailable: true, navigationTarget: "#help-request" });
    if (incident.retractedAt) items.push({ id: `incident:${incident.id}:retracted`, type: "incident_retracted", occurredAt: incident.retractedAt, effectiveAt: null, state: "completed", actorCategory: "worker", sourceCategory: "incident", label: "Help Requestを取り下げ", actionable: false, action: null, sourceAvailable: true, navigationTarget: "#help-request" });
  }
  if (facts.assignmentStatus === "completed") items.push({ id: "assignment:completed", type: "assignment_completed", occurredAt: null, effectiveAt: facts.endsAt, state: "completed", actorCategory: "derived", sourceCategory: "assignment", label: "勤務完了", actionable: false, action: null, sourceAvailable: true, navigationTarget: null });
  if (["cancelled_by_worker", "cancelled_by_company", "absent", "no_show"].includes(facts.assignmentStatus) || facts.shiftStatus === "cancelled") items.push({ id: "assignment:cancelled", type: "assignment_cancelled", occurredAt: null, effectiveAt: facts.startsAt, state: "cancelled", actorCategory: "derived", sourceCategory: "assignment", label: "勤務は終了しています", actionable: false, action: null, sourceAvailable: true, navigationTarget: null });
  items.sort((a, b) => (a.occurredAt ?? a.effectiveAt ?? "").localeCompare(b.occurredAt ?? b.effectiveAt ?? "") || rank[a.type] - rank[b.type] || a.id.localeCompare(b.id));
  return { assignmentId: facts.assignmentId, shiftId: facts.shiftId, timeZone: "Asia/Tokyo", generatedAt: facts.generatedAt, current, items, nextAction };
}

const actionRank: Record<JourneyActionKind, number> = { arrival: 0, departure: 1, wake: 2, pre_shift_confirmation: 3 };
export function compareWorkerPrimaryActions(a: { id: string; startsAt: string; timeline: ShiftTimelineProjection }, b: { id: string; startsAt: string; timeline: ShiftTimelineProjection }) {
  const aa = a.timeline.nextAction;
  const ba = b.timeline.nextAction;
  if (!aa && !ba) return a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id);
  if (!aa) return 1;
  if (!ba) return -1;
  const statePriority = (state: JourneyActionState) => state === "overdue" ? 0 : state === "actionable" ? 1 : 2;
  return statePriority(aa.state) - statePriority(ba.state)
    || (aa.state === "overdue" && ba.state === "overdue" ? actionRank[aa.kind] - actionRank[ba.kind] : 0)
    || (aa.dueAt ?? "").localeCompare(ba.dueAt ?? "")
    || a.startsAt.localeCompare(b.startsAt)
    || a.id.localeCompare(b.id);
}
