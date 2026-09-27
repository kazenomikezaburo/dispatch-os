import assert from "node:assert/strict";
// @ts-expect-error Node native TypeScript test execution requires the suffix.
import { buildShiftTimeline, compareWorkerPrimaryActions, deriveJourneyState, deriveWorkerAssignmentGroup, type WorkerJourneyFacts } from "../../lib/worker/journey/worker-journey.ts";

const base: WorkerJourneyFacts = {
  assignmentId: "10000000-0000-0000-0000-000000000001", shiftId: "20000000-0000-0000-0000-000000000001",
  generatedAt: "2026-09-27T00:00:00.000Z", assignmentStatus: "confirmed", shiftStatus: "confirmed",
  startsAt: "2026-09-27T04:00:00.000Z", endsAt: "2026-09-27T12:00:00.000Z", arrivalTarget: "2026-09-27T03:00:00.000Z",
  hasConfirmation: true, confirmationSubmittedAt: "2026-09-26T00:00:00.000Z", plannedWakeAt: "2026-09-27T01:00:00.000Z", plannedDepartureAt: "2026-09-27T02:00:00.000Z",
  wake: { operation: null, occurredAt: null, timeliness: null }, departure: { operation: null, occurredAt: null, timeliness: null }, arrival: { operation: null, occurredAt: null, timeliness: null },
  startWorkAt: null, endWorkAt: null, placementLabels: [],
};
let passed = 0;
const pass = (name: string, condition: boolean) => { assert.ok(condition, name); passed += 1; console.log(`PASS ${name}`); };
const withFact = (changes: Partial<WorkerJourneyFacts>): WorkerJourneyFacts => ({ ...base, ...changes });

pass("missing plan is not_required", deriveJourneyState(withFact({ plannedWakeAt: null }), "wake").state === "not_required");
pass("missing confirmation leaves journey scheduled", deriveJourneyState(withFact({ hasConfirmation: false }), "wake").state === "scheduled");
pass("before open is not_open", deriveJourneyState(withFact({ generatedAt: "2026-09-26T18:00:00Z" }), "wake").state === "not_open");
pass("inside window is actionable", deriveJourneyState(base, "wake").state === "actionable");
pass("past grace is overdue", deriveJourneyState(withFact({ generatedAt: "2026-09-27T01:16:00Z" }), "wake").state === "overdue");
pass("recorded on time is completed", deriveJourneyState(withFact({ wake: { operation: "recorded", occurredAt: "2026-09-27T00:30:00Z", timeliness: "early_or_on_time" } }), "wake").state === "completed");
pass("recorded late is completed_late", deriveJourneyState(withFact({ wake: { operation: "recorded", occurredAt: "2026-09-27T01:01:00Z", timeliness: "late" } }), "wake").state === "completed_late");
pass("voided current version becomes missing again", deriveJourneyState(withFact({ wake: { operation: "voided", occurredAt: null, timeliness: null } }), "wake").state === "actionable");
pass("Arrival supersedes missing earlier journey", deriveJourneyState(withFact({ arrival: { operation: "recorded", occurredAt: "2026-09-27T02:30:00Z", timeliness: "early_or_on_time" } }), "departure").state === "missing_superseded");
pass("start_work supersedes missing Arrival", deriveJourneyState(withFact({ startWorkAt: "2026-09-27T04:00:00Z" }), "arrival").state === "missing_superseded");
pass("terminal Assignment closes journey", deriveJourneyState(withFact({ assignmentStatus: "completed" }), "arrival").state === "closed");

const normal = buildShiftTimeline(withFact({ wake: { operation: "recorded", occurredAt: "2026-09-27T00:30:00Z", timeliness: "early_or_on_time" }, departure: { operation: "recorded", occurredAt: "2026-09-27T01:30:00Z", timeliness: "early_or_on_time" }, arrival: { operation: "recorded", occurredAt: "2026-09-27T02:30:00Z", timeliness: "early_or_on_time" } }), []);
pass("normal Confirmation Wake Departure Arrival are composed", ["pre_shift_confirmation", "wake", "departure", "arrival"].every((type) => normal.items.some((item) => item.type === type)));
const arrivalWork = buildShiftTimeline(withFact({ arrival: { operation: "recorded", occurredAt: "2026-09-27T02:30:00Z", timeliness: "early_or_on_time" }, startWorkAt: "2026-09-27T04:00:00Z" }), []);
pass("Arrival and start_work remain separate Timeline items", arrivalWork.items.some((item) => item.type === "arrival") && arrivalWork.items.some((item) => item.type === "attendance_start"));
const workOnly = buildShiftTimeline(withFact({ startWorkAt: "2026-09-27T04:00:00Z" }), []);
pass("start_work without Arrival shows missing_superseded", workOnly.current.arrival.state === "missing_superseded" && !workOnly.items.some((item) => item.type === "arrival" && item.occurredAt));
const incident = buildShiftTimeline(base, [{ id: "incident", state: "acknowledged", createdAt: "2026-09-27T00:10:00Z", acknowledgedAt: "2026-09-27T00:20:00Z", resolvedAt: null, retractedAt: null }]);
pass("Incident coexists without replacing nextAction", incident.items.some((item) => item.type === "incident_created") && incident.nextAction?.kind === "wake");
pass("Timeline ordering is stable", normal.items.every((item, index, values) => index === 0 || (values[index - 1].occurredAt ?? values[index - 1].effectiveAt ?? "") <= (item.occurredAt ?? item.effectiveAt ?? "")));
const overnight = buildShiftTimeline(withFact({ startsAt: "2026-09-27T15:00:00Z", endsAt: "2026-09-28T00:00:00Z", arrivalTarget: "2026-09-27T14:30:00Z" }), []);
pass("cross-midnight Shift remains instant ordered", overnight.generatedAt === base.generatedAt && overnight.items.length > 0);
pass("exactly one primary action is returned", incident.nextAction?.kind === "wake");
pass("non-required Wake and Departure are skipped", buildShiftTimeline(withFact({ plannedWakeAt: null, plannedDepartureAt: null }), []).nextAction?.kind === "arrival");
pass("overdue action remains primary", buildShiftTimeline(withFact({ generatedAt: "2026-09-27T01:16:00Z" }), []).nextAction?.kind === "wake");
pass("superseded earlier action is removed", arrivalWork.nextAction === null);
const ordered = [
  { id: "b", startsAt: base.startsAt, timeline: buildShiftTimeline(withFact({ assignmentId: "b", generatedAt: "2026-09-26T18:00:00Z" }), []) },
  { id: "a", startsAt: base.startsAt, timeline: buildShiftTimeline(withFact({ assignmentId: "a", generatedAt: "2026-09-27T01:16:00Z" }), []) },
].sort(compareWorkerPrimaryActions);
pass("Home ordering prioritizes overdue/actionable deterministically", ordered[0].id === "a");
pass("My Shifts marks future active Assignment upcoming", deriveWorkerAssignmentGroup({ ...base, generatedAt: "2026-09-27T00:00:00Z" }) === "upcoming");
pass("My Shifts marks in-progress active Assignment current", deriveWorkerAssignmentGroup({ ...base, generatedAt: "2026-09-27T05:00:00Z" }) === "current");
pass("My Shifts marks ended active Assignment past", deriveWorkerAssignmentGroup({ ...base, generatedAt: "2026-09-27T13:00:00Z" }) === "past");
pass("My Shifts marks cancelled Assignment terminal", deriveWorkerAssignmentGroup({ ...base, assignmentStatus: "cancelled_by_company" }) === "terminal");
console.log(`Worker Journey Rules final: ${passed}/${passed} passed`);
