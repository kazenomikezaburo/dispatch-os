import type { SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { IDS } from "./test-data.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { deriveAdminAttendance } from "../../lib/admin/attendance/attendance-rules.ts";

const config = readLocalConfig();
const results: boolean[] = [];
const record = (number: string, pass: boolean, actual: string) => {
  results.push(pass);
  console.log(`ABSENCE-TRANSITION-${number} ${pass ? "PASS" : "FAIL"}: ${actual}`);
};
const uid = () => crypto.randomUUID();
function sql(value: string) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: value, encoding: "utf8" }).trim();
}
function createShift(jobId: string = IDS.jobs.n1, timing: "future" | "past" | "boundary" = "past", required = 1) {
  const id = uid();
  const starts = timing === "future" ? "clock_timestamp() + interval '1 day'" : timing === "boundary" ? "clock_timestamp()" : "clock_timestamp() - interval '5 minutes'";
  const ends = timing === "future" ? "clock_timestamp() + interval '1 day 8 hours'" : "clock_timestamp() + interval '8 hours'";
  sql(`insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status) values ('${id}', '${jobId}', ${starts}, ${ends}, ${required}, 'recruiting');`);
  return id;
}
function createAssignment(shiftId: string, workerId: string = IDS.workers.workerA, status: string = "assigned") {
  const id = uid();
  sql(`insert into public.assignments (id, shift_slot_id, worker_id, source, status, assigned_by) values ('${id}', '${shiftId}', '${workerId}', 'manager', '${status}', '${IDS.users.managerA}');`);
  return id;
}
function createApplication(shiftId: string, workerId = IDS.workers.workerA) {
  const id = uid();
  sql(`insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('${id}', '${shiftId}', '${workerId}', 'accepted');`);
  return id;
}
function createStart(assignmentId: string) {
  sql(`insert into public.attendance_events (assignment_id, event_type, source) values ('${assignmentId}', 'start_work', 'manager');`);
}
const absent = (client: SupabaseClient, shiftId: string, assignmentId: string) => client.rpc("mark_assignment_absent", { p_shift_id: shiftId, p_assignment_id: assignmentId });
const noShow = (client: SupabaseClient, shiftId: string, assignmentId: string) => client.rpc("mark_assignment_no_show", { p_shift_id: shiftId, p_assignment_id: assignmentId });
const start = (client: SupabaseClient, assignmentId: string) => client.rpc("record_worker_start_work", { p_assignment_id: assignmentId });
const status = (id: string) => sql(`select status from public.assignments where id = '${id}';`);
const eventCount = (id: string) => Number(sql(`select count(*) from public.attendance_events where assignment_id = '${id}';`));

await prepareAuthFixtures(config);
const clients = await createActorClients(config);

async function transitionTest(number: string, actor: SupabaseClient, target: "absent" | "no_show", initial: string, expectSuccess: boolean, timing: "future" | "past" | "boundary" = "past", jobId: string = IDS.jobs.n1) {
  const shiftId = createShift(jobId, timing); const assignmentId = createAssignment(shiftId, jobId === IDS.jobs.t1 ? IDS.workers.workerC : IDS.workers.workerA, initial);
  const result = target === "absent" ? await absent(actor, shiftId, assignmentId) : await noShow(actor, shiftId, assignmentId);
  const pass = expectSuccess ? !result.error && status(assignmentId) === target : Boolean(result.error) && status(assignmentId) === initial;
  record(number, pass, result.error?.message ?? `${initial} -> ${status(assignmentId)}`);
  return { shiftId, assignmentId };
}

await transitionTest("001", clients.managerA, "absent", "assigned", true);
await transitionTest("002", clients.managerA, "absent", "confirmed", true);
await transitionTest("003", clients.systemAdmin, "absent", "assigned", true, "past", IDS.jobs.t1);
await transitionTest("004", clients.workerA, "absent", "assigned", false);
await transitionTest("005", clients.anon, "absent", "assigned", false);
await transitionTest("006", clients.managerA, "absent", "assigned", false, "past", IDS.jobs.t1);
{ const a = createShift(); const b = createShift(); const id = createAssignment(a); const result = await absent(clients.managerA, b, id); record("007", Boolean(result.error) && status(id) === "assigned", result.error?.message ?? "unexpected success"); }
for (const [number, initial] of [["008", "completed"], ["009", "cancelled_by_worker"], ["010", "cancelled_by_company"], ["011", "absent"], ["012", "no_show"]] as const) await transitionTest(number, clients.managerA, "absent", initial, false);
{ const s = createShift(); const a = createAssignment(s); createStart(a); const result = await absent(clients.managerA, s, a); record("013", Boolean(result.error) && status(a) === "assigned", result.error?.message ?? "unexpected success"); }
await transitionTest("014", clients.managerA, "absent", "assigned", true, "future");
await transitionTest("015", clients.managerA, "absent", "assigned", true, "past");
await transitionTest("016", clients.managerA, "no_show", "assigned", true);
await transitionTest("017", clients.managerA, "no_show", "confirmed", true);
await transitionTest("018", clients.systemAdmin, "no_show", "assigned", true, "past", IDS.jobs.t1);
await transitionTest("019", clients.workerA, "no_show", "assigned", false);
await transitionTest("020", clients.anon, "no_show", "assigned", false);
await transitionTest("021", clients.managerA, "no_show", "assigned", false, "past", IDS.jobs.t1);
{ const a = createShift(); const b = createShift(); const id = createAssignment(a); const result = await noShow(clients.managerA, b, id); record("022", Boolean(result.error) && status(id) === "assigned", result.error?.message ?? "unexpected success"); }
await transitionTest("023", clients.managerA, "no_show", "assigned", false, "future");
await transitionTest("024", clients.managerA, "no_show", "assigned", true, "boundary");
await transitionTest("025", clients.managerA, "no_show", "assigned", true, "past");
{ const s = createShift(); const a = createAssignment(s); createStart(a); const result = await noShow(clients.managerA, s, a); record("026", Boolean(result.error) && status(a) === "assigned", result.error?.message ?? "unexpected success"); }
for (const [number, initial] of [["027", "completed"], ["028", "cancelled_by_worker"], ["029", "cancelled_by_company"], ["030", "absent"], ["031", "no_show"]] as const) await transitionTest(number, clients.managerA, "no_show", initial, false);

{ const s = createShift(); const a = createAssignment(s); const race = await Promise.all([absent(clients.managerA, s, a), absent(clients.managerA, s, a)]); record("032", race.filter((r) => !r.error).length === 1 && race.filter((r) => r.error).length === 1, `success=${race.filter((r) => !r.error).length}, status=${status(a)}`); }
{ const s = createShift(); const a = createAssignment(s); const race = await Promise.all([noShow(clients.managerA, s, a), noShow(clients.managerA, s, a)]); record("033", race.filter((r) => !r.error).length === 1 && race.filter((r) => r.error).length === 1, `success=${race.filter((r) => !r.error).length}, status=${status(a)}`); }
let absentRaceFinal = "";
{ const s = createShift(); const a = createAssignment(s); const race = await Promise.all([start(clients.workerA, a), absent(clients.managerA, s, a)]); absentRaceFinal = `success=${race.filter((r) => !r.error).length}, status=${status(a)}, events=${eventCount(a)}`; record("034", race.filter((r) => !r.error).length === 1 && !(status(a) === "absent" && eventCount(a) > 0), absentRaceFinal); }
let noShowRaceFinal = "";
{ const s = createShift(); const a = createAssignment(s); const race = await Promise.all([start(clients.workerA, a), noShow(clients.managerA, s, a)]); noShowRaceFinal = `success=${race.filter((r) => !r.error).length}, status=${status(a)}, events=${eventCount(a)}`; record("035", race.filter((r) => !r.error).length === 1 && !(status(a) === "no_show" && eventCount(a) > 0), noShowRaceFinal); }
{ const s = createShift(); const a = createAssignment(s); await absent(clients.managerA, s, a); const result = await start(clients.workerA, a); record("036", Boolean(result.error) && eventCount(a) === 0, result.error?.message ?? "unexpected success"); }
{ const s = createShift(); const a = createAssignment(s); await noShow(clients.managerA, s, a); const result = await start(clients.workerA, a); record("037", Boolean(result.error) && eventCount(a) === 0, result.error?.message ?? "unexpected success"); }
const sideShift = createShift(undefined, "past", 2); const sideApp = createApplication(sideShift); const sideA = createAssignment(sideShift); const beforeRecords = Number(sql("select count(*) from public.attendance_records;")); const beforeApp = sql(`select status from public.shift_applications where id='${sideApp}';`); const beforeShift = sql(`select status from public.shift_slots where id='${sideShift}';`); const beforeActive = Number(sql(`select count(*) from public.assignments where shift_slot_id='${sideShift}' and status in ('assigned','confirmed','completed');`)); await absent(clients.managerA, sideShift, sideA); const afterActive = Number(sql(`select count(*) from public.assignments where shift_slot_id='${sideShift}' and status in ('assigned','confirmed','completed');`));
record("038", eventCount(sideA) === 0, `events=${eventCount(sideA)}`);
const noShowSideShift = createShift(); const noShowSideA = createAssignment(noShowSideShift); await noShow(clients.managerA, noShowSideShift, noShowSideA); record("039", eventCount(noShowSideA) === 0, `events=${eventCount(noShowSideA)}`);
record("040", Number(sql("select count(*) from public.attendance_records;")) === beforeRecords, `before=${beforeRecords}`);
record("041", sql(`select status from public.shift_applications where id='${sideApp}';`) === beforeApp, `status=${beforeApp}`);
record("042", sql(`select status from public.shift_slots where id='${sideShift}';`) === beforeShift, `status=${beforeShift}`);
record("043", beforeActive - afterActive === 1, `before=${beforeActive}, after=${afterActive}`);
record("044", Math.max(2 - afterActive, 0) - Math.max(2 - beforeActive, 0) === 1, `shortage ${Math.max(2 - beforeActive, 0)} -> ${Math.max(2 - afterActive, 0)}`);
const base = { id: "a", shiftId: "s", status: "absent", workerName: "A", startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 60_000).toISOString(), projectName: "P", jobName: "J", workplaceName: "W", startWorkAt: null, endWorkAt: null };
record("045", deriveAdminAttendance(base, new Date()).state === "absent", "state=absent");
record("046", deriveAdminAttendance({ ...base, status: "no_show" }, new Date()).state === "no_show", "state=no_show");
record("047", deriveAdminAttendance({ ...base, status: "no_show" }, new Date()).state !== "start_missing", "no_show only");
const actionSource = readFileSync("app/actions/assignments.ts", "utf8");
record("048", !/export async function markAssignment.*status/i.test(actionSource), "only shiftId and assignmentId exported");
record("049", actionSource.includes("最新の勤務状況を確認して") && !actionSource.includes("return failure(error"), "generalized errors");
const privileges = sql(`select p.prosecdef || '|' || p.proconfig[1] || '|' || has_function_privilege('public', p.oid, 'execute') || '|' || has_function_privilege('anon', p.oid, 'execute') || '|' || has_function_privilege('authenticated', p.oid, 'execute') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('mark_assignment_absent','mark_assignment_no_show') order by p.proname;`);
record("050", privileges.split("\n").every((row) => row === 'true|search_path=""|false|false|true'), privileges.replaceAll("\n", "; "));

console.log(`RACE-ABSENT-FINAL=${absentRaceFinal}`);
console.log(`RACE-NO-SHOW-FINAL=${noShowRaceFinal}`);
const passed = results.filter(Boolean).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
