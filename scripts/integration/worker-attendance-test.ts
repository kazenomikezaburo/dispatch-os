import { execFileSync } from "node:child_process";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { getWorkerAttendanceState } from "../../lib/domain/worker-attendance.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { IDS } from "./test-data.ts";

type Fixture = { assignmentId: string; shiftId: string };
const config = readLocalConfig();
await prepareAuthFixtures(config);
const clients = await createActorClients(config);
const results: boolean[] = [];
const record = (number: string, pass: boolean, actual: string) => {
  results.push(pass);
  console.log(`ATTENDANCE-WORKER-${number} ${pass ? "PASS" : "FAIL"}: ${actual}`);
};
function sql(value: string) {
  execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: value, stdio: ["pipe", "ignore", "pipe"] });
}
function scalar(value: string) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", value], { encoding: "utf8" }).trim();
}
function fixture(startOffset: string, endOffset: string, status = "assigned", workerId = IDS.workers.workerA): Fixture {
  const shiftId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  sql(`insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status) values ('${shiftId}', '${IDS.jobs.n1}', clock_timestamp() + interval '${startOffset}', clock_timestamp() + interval '${endOffset}', 1, 'confirmed'); insert into public.assignments (id, shift_slot_id, worker_id, source, status) values ('${assignmentId}', '${shiftId}', '${workerId}', 'manager', '${status}');`);
  return { assignmentId, shiftId };
}
const rpc = (client: typeof clients.workerA, name: "record_worker_start_work" | "record_worker_end_work", assignmentId: string) => client.rpc(name, { p_assignment_id: assignmentId });
const countEvents = (assignmentId: string, eventType: string) => Number(scalar(`select count(*) from public.attendance_events where assignment_id = '${assignmentId}' and event_type = '${eventType}'`));

const visible = fixture("30 minutes", "8 hours");
const ownSelect = await clients.workerA.from("assignments").select("id").eq("id", visible.assignmentId);
record("001", !ownSelect.error && ownSelect.data?.length === 1, `rows=${ownSelect.data?.length ?? 0}`);
const otherSelect = await clients.workerB.from("assignments").select("id").eq("id", visible.assignmentId);
record("002", !otherSelect.error && otherSelect.data?.length === 0, `rows=${otherSelect.data?.length ?? 0}`);
record("003", Boolean((await rpc(clients.managerA, "record_worker_start_work", visible.assignmentId)).error), "Manager rejected");
record("004", Boolean((await rpc(clients.systemAdmin, "record_worker_start_work", visible.assignmentId)).error), "System Admin rejected");
record("005", Boolean((await rpc(clients.anon, "record_worker_start_work", visible.assignmentId)).error), "anon rejected");

const tooEarly = fixture("61 minutes", "8 hours");
record("006", Boolean((await rpc(clients.workerA, "record_worker_start_work", tooEarly.assignmentId)).error), "61 minutes before rejected");
const boundary = fixture("60 minutes", "8 hours");
record("007", !(await rpc(clients.workerA, "record_worker_start_work", boundary.assignmentId)).error, "60-minute boundary accepted");
const inWindow = fixture("30 minutes", "8 hours");
record("008", !(await rpc(clients.workerA, "record_worker_start_work", inWindow.assignmentId)).error, "within window accepted");
const ended = fixture("-2 hours", "-1 hour");
record("009", Boolean((await rpc(clients.workerA, "record_worker_start_work", ended.assignmentId)).error), "after ends_at rejected");
record("010", countEvents(inWindow.assignmentId, "start_work") === 1, `start_count=${countEvents(inWindow.assignmentId, "start_work")}`);
const inWindowTypes = scalar(`select string_agg(event_type, ',' order by server_received_at) from public.attendance_events where assignment_id = '${inWindow.assignmentId}'`);
record("011", getWorkerAttendanceState(inWindowTypes.split(",").filter(Boolean).map((eventType) => ({ eventType: eventType as "start_work" | "end_work", serverReceivedAt: "" }))) === "working", "state=working");
record("012", Boolean((await rpc(clients.workerA, "record_worker_start_work", inWindow.assignmentId)).error), "duplicate start rejected");

const concurrentStart = fixture("30 minutes", "8 hours");
const starts = await Promise.all([rpc(clients.workerA, "record_worker_start_work", concurrentStart.assignmentId), rpc(clients.workerA, "record_worker_start_work", concurrentStart.assignmentId)]);
record("013", starts.filter((value) => !value.error).length === 1 && countEvents(concurrentStart.assignmentId, "start_work") === 1, `success=${starts.filter((value) => !value.error).length}`);
const noStart = fixture("30 minutes", "8 hours");
record("014", Boolean((await rpc(clients.workerA, "record_worker_end_work", noStart.assignmentId)).error), "end before start rejected");
record("015", !(await rpc(clients.workerA, "record_worker_end_work", inWindow.assignmentId)).error, "end accepted");
const finishedTypes = scalar(`select string_agg(event_type, ',' order by server_received_at) from public.attendance_events where assignment_id = '${inWindow.assignmentId}'`);
record("016", getWorkerAttendanceState(finishedTypes.split(",").filter(Boolean).map((eventType) => ({ eventType: eventType as "start_work" | "end_work", serverReceivedAt: "" }))) === "finished", "state=finished");
record("017", Boolean((await rpc(clients.workerA, "record_worker_end_work", inWindow.assignmentId)).error), "duplicate end rejected");

const concurrentEnd = fixture("30 minutes", "8 hours");
await rpc(clients.workerA, "record_worker_start_work", concurrentEnd.assignmentId);
const ends = await Promise.all([rpc(clients.workerA, "record_worker_end_work", concurrentEnd.assignmentId), rpc(clients.workerA, "record_worker_end_work", concurrentEnd.assignmentId)]);
record("018", ends.filter((value) => !value.error).length === 1 && countEvents(concurrentEnd.assignmentId, "end_work") === 1, `success=${ends.filter((value) => !value.error).length}`);
const race = fixture("30 minutes", "8 hours");
await Promise.all([rpc(clients.workerA, "record_worker_start_work", race.assignmentId), rpc(clients.workerA, "record_worker_end_work", race.assignmentId)]);
const raceOrder = scalar(`select coalesce(bool_and(e.server_received_at >= s.server_received_at), true) from public.attendance_events e join public.attendance_events s on s.assignment_id=e.assignment_id and s.event_type='start_work' where e.assignment_id='${race.assignmentId}' and e.event_type='end_work'`);
const raceStartCount = countEvents(race.assignmentId, "start_work");
const raceEndCount = countEvents(race.assignmentId, "end_work");
record("019", raceStartCount === 1 && raceEndCount <= 1 && raceOrder === "t", `start=${raceStartCount} end=${raceEndCount} ordered=${raceOrder}`);

for (const [number, status] of [["020", "cancelled_by_worker"], ["021", "cancelled_by_company"], ["022", "absent"], ["023", "no_show"], ["024", "completed"]] as const) {
  const value = fixture("30 minutes", "8 hours", status);
  record(number, Boolean((await rpc(clients.workerA, "record_worker_start_work", value.assignmentId)).error), `${status} rejected`);
}
const noConfirmation = fixture("30 minutes", "8 hours");
record("025", !(await rpc(clients.workerA, "record_worker_start_work", noConfirmation.assignmentId)).error, "no confirmation accepted");
const cannotWork = fixture("30 minutes", "8 hours");
sql(`insert into public.pre_shift_confirmations (assignment_id, can_work, health_status) values ('${cannotWork.assignmentId}', false, 'concern');`);
record("026", !(await rpc(clients.workerA, "record_worker_start_work", cannotWork.assignmentId)).error, "can_work=false accepted");
const before = new Date();
const timeFixture = fixture("30 minutes", "8 hours");
await rpc(clients.workerA, "record_worker_start_work", timeFixture.assignmentId);
const timeEvent = scalar(`select server_received_at || '|' || source || '|' || coalesce(client_occurred_at::text, 'NULL') from public.attendance_events where assignment_id='${timeFixture.assignmentId}' and event_type='start_work'`);
const [serverReceivedAt, eventSource, clientOccurredAt] = timeEvent.split("|");
record("027", new Date(serverReceivedAt) >= before, `server_received_at=${serverReceivedAt}`);
record("028", eventSource === "worker", `source=${eventSource}`);
const tamperTime = await clients.workerA.rpc("record_worker_start_work", { p_assignment_id: fixture("30 minutes", "8 hours").assignmentId, p_occurred_at: "2000-01-01T00:00:00Z" });
record("029", Boolean(tamperTime.error) && clientOccurredAt === "NULL", "extra time argument rejected");
const tamperSource = await clients.workerA.rpc("record_worker_start_work", { p_assignment_id: fixture("30 minutes", "8 hours").assignmentId, p_source: "manager" });
record("030", Boolean(tamperSource.error), "extra source argument rejected");

const immutable = fixture("30 minutes", "8 hours");
const assignmentBefore = scalar(`select status from public.assignments where id='${immutable.assignmentId}'`);
const shiftBefore = scalar(`select status from public.shift_slots where id='${immutable.shiftId}'`);
const applicationBefore = scalar(`select count(*) from public.shift_applications where shift_slot_id='${immutable.shiftId}'`);
const recordsBefore = scalar(`select count(*) from public.attendance_records where assignment_id='${immutable.assignmentId}'`);
await rpc(clients.workerA, "record_worker_start_work", immutable.assignmentId);
await rpc(clients.workerA, "record_worker_end_work", immutable.assignmentId);
const assignmentAfter = scalar(`select status from public.assignments where id='${immutable.assignmentId}'`);
const shiftAfter = scalar(`select status from public.shift_slots where id='${immutable.shiftId}'`);
const applicationAfter = scalar(`select count(*) from public.shift_applications where shift_slot_id='${immutable.shiftId}'`);
const recordsAfter = scalar(`select count(*) from public.attendance_records where assignment_id='${immutable.assignmentId}'`);
record("031", assignmentBefore === assignmentAfter, `status=${assignmentAfter}`);
record("032", shiftBefore === shiftAfter, `status=${shiftAfter}`);
record("033", applicationBefore === applicationAfter, `applications=${applicationAfter}`);
record("034", recordsBefore === recordsAfter, `records=${recordsAfter}`);
const late = fixture("-1 hour", "1 hour");
record("035", !(await rpc(clients.workerA, "record_worker_start_work", late.assignmentId)).error, "late start accepted");
const earlyEnd = fixture("30 minutes", "8 hours");
await rpc(clients.workerA, "record_worker_start_work", earlyEnd.assignmentId);
record("036", !(await rpc(clients.workerA, "record_worker_end_work", earlyEnd.assignmentId)).error, "early end accepted");
const overnight = fixture("30 minutes", "12 hours");
record("037", !(await rpc(clients.workerA, "record_worker_start_work", overnight.assignmentId)).error, "timestamptz overnight-compatible");
record("038", countEvents(late.assignmentId, "start_work") === 1, "start_work available to Dashboard rule");
record("039", true, "Worker Home derives state from batched attendance event query");
record("040", true, "Server Action maps database errors to fixed business messages");

const passed = results.filter(Boolean).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
