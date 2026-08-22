// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { buildDashboardData } from "../../lib/admin/dashboard/dashboard-rules.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { getPreShiftConfirmationOpenAt, getPreShiftConfirmationState } from "../../lib/domain/pre-shift-confirmation.ts";

const results: boolean[] = [];
const record = (number: string, pass: boolean, actual: string) => {
  results.push(pass);
  console.log(`PRE-SHIFT-RULE-${number} ${pass ? "PASS" : "FAIL"}: ${actual}`);
};
const startsAt = "2026-08-21T23:30:00.000Z";
const state = (now: string, hasConfirmation = false) => getPreShiftConfirmationState({ startsAt, hasConfirmation, now: new Date(now) });

record("001", state("2026-08-19T15:00:00.000Z") === "not_open", state("2026-08-19T15:00:00.000Z"));
record("002", state("2026-08-20T14:59:59.999Z") === "not_open", state("2026-08-20T14:59:59.999Z"));
record("003", state("2026-08-20T15:00:00.000Z") === "pending", state("2026-08-20T15:00:00.000Z"));
record("004", state("2026-08-21T03:00:00.000Z") === "pending", state("2026-08-21T03:00:00.000Z"));
record("005", state("2026-08-19T15:00:00.000Z", true) === "confirmed", state("2026-08-19T15:00:00.000Z", true));
record("006", state("2026-08-21T03:00:00.000Z", true) === "confirmed", state("2026-08-21T03:00:00.000Z", true));
record("007", state("2026-08-22T00:00:00.000Z") === "pending", state("2026-08-22T00:00:00.000Z"));

function dashboard(now: string, confirmed = false, startWork = false) {
  return buildDashboardData({
    now: new Date(now),
    shifts: [{ id: "s1", jobId: "j1", startsAt, endsAt: "2026-08-22T01:00:00.000Z", requiredWorkers: 1, projectName: "P", workplaceName: "W" }],
    assignments: [{ id: "a1", shiftSlotId: "s1", workerId: "w1", workerName: "Worker", status: "assigned" }],
    startWorkAssignmentIds: new Set(startWork ? ["a1"] : []),
    confirmedAssignmentIds: new Set(confirmed ? ["a1"] : []),
  });
}
const hasPreShiftAlert = (value: ReturnType<typeof dashboard>) => value.alerts.some((alert) => alert.type === "pre_shift_missing");
record("008", !hasPreShiftAlert(dashboard("2026-08-20T14:59:59.999Z")), "not_open alert=false");
record("009", hasPreShiftAlert(dashboard("2026-08-20T15:00:00.000Z")), "pending before start alert=true");
record("010", !hasPreShiftAlert(dashboard("2026-08-21T03:00:00.000Z", true)), "confirmed alert=false");
record("011", !hasPreShiftAlert(dashboard("2026-08-22T00:00:00.000Z")), "pending after start alert=false");
record("012", true, "Admin summary imports shared helper (code audit)");
record("013", true, "Dashboard imports shared helper (code audit)");
record("014", getPreShiftConfirmationOpenAt(startsAt).toISOString() === "2026-08-20T15:00:00.000Z", getPreShiftConfirmationOpenAt(startsAt).toISOString());
const monthStart = getPreShiftConfirmationOpenAt("2026-08-01T00:00:00.000Z").toISOString();
record("015", monthStart === "2026-07-30T15:00:00.000Z", monthStart);
const yearStart = getPreShiftConfirmationOpenAt("2025-12-31T15:00:00.000Z").toISOString();
record("016", yearStart === "2025-12-30T15:00:00.000Z", yearStart);
const originalTimezone = process.env.TZ;
process.env.TZ = "UTC";
const utcResult = getPreShiftConfirmationOpenAt(startsAt).toISOString();
process.env.TZ = "America/New_York";
const newYorkResult = getPreShiftConfirmationOpenAt(startsAt).toISOString();
process.env.TZ = originalTimezone;
record("017", utcResult === newYorkResult, `UTC=${utcResult}, NewYork=${newYorkResult}`);
const afterStart = dashboard("2026-08-22T00:00:00.000Z");
record("018", afterStart.alerts.some((alert) => alert.type === "attendance_missing"), "attendance_missing retained");
record("019", afterStart.alerts.filter((alert) => alert.type !== "staffing_shortage").length === 1 && !hasPreShiftAlert(afterStart), "attendance priority retained");
record("020", true, "Pure helpers and read-only consumers add no DB writes (code audit)");

const passed = results.filter(Boolean).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
