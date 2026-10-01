import assert from "node:assert/strict";
import test from "node:test";
import { selectWorkerHomeEndWork, selectWorkerHomeNextAction, selectWorkerHomeNextShift } from "../../lib/worker/home/worker-home";
import type { WorkerAssignment } from "../../lib/worker/worker-assignment-types";

function assignment(id: string, startsAt: string, endsAt: string, state: "not_open" | "actionable" | "overdue" | null, kind: "pre_shift_confirmation" | "wake" | "departure" | "arrival" = "pre_shift_confirmation"): WorkerAssignment {
  return { id, assignmentStatus: "assigned", shiftStatus: "scheduled", startsAt, endsAt, timeline: { assignmentId: id, shiftId: id, timeZone: "Asia/Tokyo", generatedAt: "2026-10-01T00:00:00.000Z", current: { wake: { type: "wake", state: "not_required", dueAt: null, occurredAt: null }, departure: { type: "departure", state: "not_required", dueAt: null, occurredAt: null }, arrival: { type: "arrival", state: "scheduled", dueAt: startsAt, occurredAt: null } }, items: [], nextAction: state ? { kind, state, dueAt: startsAt, href: `/worker/assignments/${id}#action`, label: "Action" } : null } } as unknown as WorkerAssignment;
}

test("Next Action reuses canonical overdue/actionable priority and hides not-open candidates", () => {
  const notOpen = assignment("not-open", "2026-10-02T01:00:00Z", "2026-10-02T09:00:00Z", "not_open");
  const actionable = assignment("actionable", "2026-10-01T04:00:00Z", "2026-10-01T09:00:00Z", "actionable");
  const overdue = assignment("overdue", "2026-10-01T03:00:00Z", "2026-10-01T08:00:00Z", "overdue", "arrival");
  assert.equal(selectWorkerHomeNextAction([notOpen, actionable, overdue])?.id, "overdue");
  assert.equal(selectWorkerHomeNextAction([notOpen]), null);
});

test("Next Shift prefers the current shift, then the earliest upcoming shift", () => {
  const current = assignment("current", "2026-09-30T23:00:00Z", "2026-10-01T02:00:00Z", null);
  const upcoming = assignment("upcoming", "2026-10-02T01:00:00Z", "2026-10-02T09:00:00Z", null);
  assert.equal(selectWorkerHomeNextShift([upcoming, current])?.id, "current");
});

test("terminal and ended assignments are not presented as home actions", () => {
  const ended = assignment("ended", "2026-09-29T01:00:00Z", "2026-09-29T09:00:00Z", "overdue");
  const cancelled = { ...assignment("cancelled", "2026-10-02T01:00:00Z", "2026-10-02T09:00:00Z", "actionable"), assignmentStatus: "cancelled_by_company" as const };
  assert.equal(selectWorkerHomeNextAction([ended, cancelled]), null);
  assert.equal(selectWorkerHomeNextShift([ended, cancelled]), null);
});

test("existing attendance contract exposes end-work only for an active assignment", () => {
  const working = { ...assignment("working", "2026-09-30T23:00:00Z", "2026-10-01T02:00:00Z", null), canEndWork: true };
  const ended = { ...assignment("ended", "2026-09-29T01:00:00Z", "2026-09-29T09:00:00Z", null), canEndWork: true };
  assert.equal(selectWorkerHomeEndWork([ended, working])?.id, "working");
});
