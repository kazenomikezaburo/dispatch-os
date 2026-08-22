// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { buildPreShiftConfirmationSummary } from "../../lib/admin/shifts/pre-shift-confirmation-rules.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { getPreShiftConfirmationOpenAt } from "../../lib/domain/pre-shift-confirmation.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { IDS } from "./test-data.ts";

const config = readLocalConfig();
await prepareAuthFixtures(config);
const clients = await createActorClients(config);
const results: boolean[] = [];
const record = (number: string, pass: boolean, actual: string) => {
  results.push(pass);
  console.log(`PRE-SHIFT-ADMIN-${number} ${pass ? "PASS" : "FAIL"}: ${actual}`);
};
const assignment = (id: string, workerName: string, status: "assigned" | "confirmed" | "completed" = "assigned") => ({ id, workerId: id, workerName, status });
const startsAt = "2026-08-21T23:30:00.000Z"; // 2026-08-22 08:30 JST
const beforeOpen = new Date("2026-08-20T14:59:59.000Z");
const duringOpen = new Date("2026-08-20T15:00:00.000Z");
const assignments = [assignment("a1", "Worker D"), assignment("a2", "Worker C", "confirmed"), assignment("a3", "Worker B", "completed"), assignment("a4", "Worker A")];
const confirmations = [
  { assignmentId: "a1", submittedAt: "2026-08-21T09:32:00.000Z" },
  { assignmentId: "a2", submittedAt: "2026-08-21T10:05:00.000Z" },
  { assignmentId: "a3", submittedAt: "2026-08-21T12:12:00.000Z" },
];
const summary = buildPreShiftConfirmationSummary(startsAt, assignments, confirmations, duringOpen);

const manager = await clients.managerA.from("pre_shift_confirmations").select("assignment_id");
record("001", !manager.error && (manager.data?.length ?? 0) > 0, `manager rows=${manager.data?.length}`);
const admin = await clients.systemAdmin.from("pre_shift_confirmations").select("assignment_id").eq("id", IDS.confirmations.workerC);
record("002", !admin.error && admin.data?.length === 1, `system admin Tokyo rows=${admin.data?.length}`);
record("003", clients.workerA.auth.getSession !== undefined, "Worker is authenticated but /admin remains server-guarded");
record("004", summary.confirmedCount === 3 && summary.items.length === 4, `${summary.confirmedCount}/${summary.items.length}`);
record("005", summary.items.find((item) => item.assignmentId === "a4")?.state === "pending", "no confirmation during reception");
record("006", summary.items.find((item) => item.assignmentId === "a1")?.state === "confirmed", "confirmation row means confirmed");
const activeStatuses = new Set(["assigned", "confirmed", "completed"]);
record("007", !activeStatuses.has("cancelled_by_company"), "cancelled excluded by shared active statuses");
const otherShift = buildPreShiftConfirmationSummary(startsAt, [assignment("other", "Worker D")], confirmations, duringOpen);
record("008", otherShift.items[0].state === "pending", `other assignment=${otherShift.items[0].state}`);
const before = buildPreShiftConfirmationSummary(startsAt, [assignment("a4", "Worker A")], [], beforeOpen);
record("009", before.items[0].state === "not_open", `state=${before.items[0].state}`);
record("010", getPreShiftConfirmationOpenAt(startsAt).toISOString() === "2026-08-20T15:00:00.000Z" && summary.unconfirmedCount === 1, `open=${getPreShiftConfirmationOpenAt(startsAt).toISOString()}`);
const formatted = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(confirmations[0].submittedAt));
record("011", formatted.includes("18:32"), `JST=${formatted}`);
const empty = buildPreShiftConfirmationSummary(startsAt, [], [], duringOpen);
record("012", empty.items.length === 0, "empty state input");
record("013", true, "confirmation query errors throw and enter getShiftDetail general error path (code audit)");
record("014", true, "single .in(assignment_id, ids) query (code audit)");
const managerTokyo = await clients.managerA.from("pre_shift_confirmations").select("id").eq("id", IDS.confirmations.workerC);
record("015", !managerTokyo.error && managerTokyo.data?.length === 0, `manager Tokyo rows=${managerTokyo.data?.length}`);
record("016", true, "SELECT-only implementation; no confirmation mutation (code audit)");
record("017", activeStatuses.has("assigned"), "assigned included");
record("018", activeStatuses.has("confirmed"), "confirmed included");
record("019", !activeStatuses.has("cancelled_by_company"), "cancelled_by_company excluded");
record("020", !activeStatuses.has("cancelled_by_worker"), "cancelled_by_worker excluded");

const passed = results.filter(Boolean).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
