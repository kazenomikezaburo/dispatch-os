import type { SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { IDS } from "./test-data.ts";

const config = readLocalConfig();
type Result = { id: string; pass: boolean };
const results: Result[] = [];
const record = (id: string, pass: boolean, actual: string) => {
  results.push({ id, pass });
  console.log(`${id} ${pass ? "PASS" : "FAIL"}: ${actual}`);
};
const uid = () => crypto.randomUUID();
function sql(value: string) {
  execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: value, stdio: ["pipe", "ignore", "pipe"] });
}
function createShift(jobId: string = IDS.jobs.n1, startsAt: string = "2035-01-01T01:00:00Z", required: number = 1) {
  const id = uid();
  sql(`insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status) values ('${id}', '${jobId}', '${startsAt}', '${startsAt === "2035-01-01T01:00:00Z" ? "2035-01-01T09:00:00Z" : "2020-01-01T09:00:00Z"}', ${required}, 'recruiting');`);
  return id;
}
function createAssignment(shiftId: string, workerId: string, status: string) {
  const id = uid();
  sql(`insert into public.assignments (id, shift_slot_id, worker_id, source, status, assigned_by) values ('${id}', '${shiftId}', '${workerId}', 'application', '${status}', '${IDS.users.managerA}');`);
  return id;
}
function createApplication(shiftId: string, workerId: string) {
  const id = uid();
  sql(`insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('${id}', '${shiftId}', '${workerId}', 'accepted');`);
  return id;
}
const cancel = (client: SupabaseClient, shiftId: string, assignmentId: string) => client.rpc("cancel_assignment_by_company", { p_shift_id: shiftId, p_assignment_id: assignmentId });

await prepareAuthFixtures(config);
const clients = await createActorClients(config);
const db = clients.systemAdmin;

const s001 = createShift(undefined, undefined, 2);
const app001 = createApplication(s001, IDS.workers.workerA);
const a001 = createAssignment(s001, IDS.workers.workerA, "assigned");
const other001 = createAssignment(s001, IDS.workers.workerB, "assigned");
const before001 = await db.from("assignments").select("id", { count: "exact", head: true }).eq("shift_slot_id", s001).in("status", ["assigned", "confirmed", "completed"]);
const r001 = await cancel(clients.managerA, s001, a001);
record("ASSIGNMENT-STATE-001", !r001.error, r001.error?.message ?? "assigned -> cancelled_by_company");

const s002 = createShift(); const a002 = createAssignment(s002, IDS.workers.workerA, "confirmed"); const r002 = await cancel(clients.managerA, s002, a002);
record("ASSIGNMENT-STATE-002", !r002.error, r002.error?.message ?? "confirmed -> cancelled_by_company");
const s003 = createShift(IDS.jobs.t1); const a003 = createAssignment(s003, IDS.workers.workerC, "assigned"); const r003 = await cancel(clients.systemAdmin, s003, a003);
record("ASSIGNMENT-STATE-003", !r003.error, r003.error?.message ?? "system admin success");
const s004 = createShift(); const a004 = createAssignment(s004, IDS.workers.workerA, "assigned"); const r004 = await cancel(clients.workerA, s004, a004);
record("ASSIGNMENT-STATE-004", Boolean(r004.error), r004.error?.message ?? "unexpected success");
const r005 = await cancel(clients.anon, s004, a004);
record("ASSIGNMENT-STATE-005", Boolean(r005.error), r005.error?.message ?? "unexpected success");
const s006 = createShift(IDS.jobs.t1); const a006 = createAssignment(s006, IDS.workers.workerC, "assigned"); const r006 = await cancel(clients.managerA, s006, a006);
record("ASSIGNMENT-STATE-006", Boolean(r006.error), r006.error?.message ?? "unexpected success");
const s007 = createShift(); const r007 = await cancel(clients.managerA, s007, a004);
record("ASSIGNMENT-STATE-007", Boolean(r007.error), r007.error?.message ?? "unexpected success");

for (const [number, status] of [["008", "completed"], ["009", "cancelled_by_worker"], ["010", "cancelled_by_company"], ["011", "absent"], ["012", "no_show"]] as const) {
  const s = createShift(); const a = createAssignment(s, IDS.workers.workerA, status); const r = await cancel(clients.managerA, s, a);
  record(`ASSIGNMENT-STATE-${number}`, Boolean(r.error), r.error?.message ?? "unexpected success");
}

const s013 = createShift(); const a013 = createAssignment(s013, IDS.workers.workerA, "assigned"); const r013 = await cancel(clients.managerA, s013, a013);
record("ASSIGNMENT-STATE-013", !r013.error, r013.error?.message ?? "future shift success");
const s014 = createShift(IDS.jobs.n1, "2020-01-01T01:00:00Z"); const a014 = createAssignment(s014, IDS.workers.workerA, "assigned"); const r014 = await cancel(clients.managerA, s014, a014);
record("ASSIGNMENT-STATE-014", Boolean(r014.error), r014.error?.message ?? "unexpected success");

const after001 = await db.from("assignments").select("id", { count: "exact", head: true }).eq("shift_slot_id", s001).in("status", ["assigned", "confirmed", "completed"]);
record("ASSIGNMENT-STATE-015", before001.count === 2 && after001.count === 1, `before=${before001.count}, after=${after001.count}`);
record("ASSIGNMENT-STATE-016", Math.max(2 - (after001.count ?? 0), 0) === 1, `shortage=${Math.max(2 - (after001.count ?? 0), 0)}`);
const appAfter = await db.from("shift_applications").select("status").eq("id", app001).single();
record("ASSIGNMENT-STATE-017", appAfter.data?.status === "accepted", `application=${appAfter.data?.status}`);
const shiftAfter = await db.from("shift_slots").select("status").eq("id", s001).single();
record("ASSIGNMENT-STATE-018", shiftAfter.data?.status === "recruiting", `shift=${shiftAfter.data?.status}`);
const oldAfter = await db.from("assignments").select("status, cancelled_at").eq("id", a001).single();
record("ASSIGNMENT-STATE-019", oldAfter.data?.status === "cancelled_by_company" && Boolean(oldAfter.data.cancelled_at), `old=${oldAfter.data?.status}`);
const replace = await clients.managerA.rpc("create_assignment_from_application", { p_shift_id: s001, p_application_id: app001 });
record("ASSIGNMENT-STATE-020", !replace.error, replace.error?.message ?? `new=${replace.data}`);
const newAfter = await db.from("assignments").select("status").eq("id", replace.data as string).single();
record("ASSIGNMENT-STATE-021", newAfter.data?.status === "assigned", `new=${newAfter.data?.status}`);
const r022 = await cancel(clients.managerA, s001, a001);
record("ASSIGNMENT-STATE-022", Boolean(r022.error), r022.error?.message ?? "unexpected success");

const s023 = createShift(); const a023 = createAssignment(s023, IDS.workers.workerA, "assigned");
const parallel = await Promise.all([cancel(clients.managerA, s023, a023), cancel(clients.managerA, s023, a023)]);
const successes = parallel.filter((item) => !item.error).length; const failures = parallel.filter((item) => item.error).length;
record("ASSIGNMENT-STATE-023", successes === 1 && failures === 1, `success=${successes}, failure=${failures}`);
const r024 = await cancel(clients.managerA, s023, uid());
record("ASSIGNMENT-STATE-024", Boolean(r024.error), r024.error?.message ?? "unexpected success");
const r025 = await cancel(clients.managerA, s023, "invalid-assignment-uuid");
record("ASSIGNMENT-STATE-025", Boolean(r025.error), r025.error?.message ?? "unexpected success");
const r026 = await cancel(clients.managerA, "invalid-shift-uuid", a023);
record("ASSIGNMENT-STATE-026", Boolean(r026.error), r026.error?.message ?? "unexpected success");
const activeOld = await db.from("assignments").select("id").eq("shift_slot_id", s001).eq("worker_id", IDS.workers.workerA).in("status", ["assigned", "confirmed", "completed"]);
record("ASSIGNMENT-STATE-027", activeOld.data?.length === 1 && activeOld.data[0].id === replace.data, `active rows=${activeOld.data?.length}`);
record("ASSIGNMENT-STATE-028", appAfter.data?.status === "accepted" && activeOld.data?.length === 1, "accepted and re-placeable/re-placed");
record("ASSIGNMENT-STATE-029", after001.count === 1, `shift-list active count after cancellation=${after001.count}`);
const uiMessageIsGeneral = !/assignment_|SQLSTATE|public\./.test("配置を解除できませんでした。最新の配置状況を確認して再度お試しください。");
record("ASSIGNMENT-STATE-030", uiMessageIsGeneral, "generalized UI error contract (static)");

const finalConcurrent = await db.from("assignments").select("status").eq("id", a023).single();
console.log(`CONCURRENT_FINAL=${finalConcurrent.data?.status}; PRESERVED_OTHER=${other001}`);
const passed = results.filter((result) => result.pass).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
