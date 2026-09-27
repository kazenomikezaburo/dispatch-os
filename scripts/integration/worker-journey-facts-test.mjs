import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const actor = {
  workerA: "a0000000-0000-0000-0000-000000000001",
  workerC: "a0000000-0000-0000-0000-000000000003",
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const worker = {
  a: "c0000000-0000-0000-0000-000000000001",
  c: "c0000000-0000-0000-0000-000000000003",
};
const job = {
  own: "10000000-0000-0000-0000-000000000001",
  foreign: "10000000-0000-0000-0000-000000000003",
};
const names = [
  "wakeBefore", "wakeNormal", "wakeLate", "wakeMissing", "departureBefore",
  "departureNormal", "departureLate", "arrivalBefore", "arrivalNormal", "arrivalLate",
  "ended", "cancelled", "terminal", "foreign", "started", "arrivalDownstream",
  "voidRerecord", "adminVoid", "concurrentWake", "departureWithoutWake", "arrivalBeforeWork",
];
const uuid = (kind, n) => `b28${kind}0000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const shift = Object.fromEntries(names.map((name, index) => [name, uuid("1", index + 1)]));
const assignment = Object.fromEntries(names.map((name, index) => [name, uuid("2", index + 1)]));
const confirmation = Object.fromEntries(names.map((name, index) => [name, uuid("3", index + 1)]));
const key = (n) => uuid("9", n);
let passed = 0;

function sql(statement, allowFailure = false) {
  try {
    return execFileSync("docker", psql, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    throw error;
  }
}

function roleSql(profileId, statement, role = "authenticated") {
  return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; ${statement}; commit;`;
}

function result(profileId, expression, role = "authenticated") {
  return JSON.parse(sql(roleSql(profileId, `select (${expression})::text`, role)).split(/\r?\n/).at(-1));
}

function concurrentResult(profileId, expression) {
  const statement = roleSql(profileId, `select (${expression})::text`);
  return new Promise((resolve, reject) => {
    const child = spawn("docker", psql, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)))
      : reject(new Error(stderr || stdout)));
    child.stdin.end(statement);
  });
}

function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  sql(`begin;
    delete from public.assignment_journey_event_versions where assignment_id::text like 'b2820000-0000-0000-0000-%';
    delete from public.attendance_events where assignment_id::text like 'b2820000-0000-0000-0000-%';
    delete from public.pre_shift_confirmations where assignment_id::text like 'b2820000-0000-0000-0000-%';
    delete from public.assignments where id::text like 'b2820000-0000-0000-0000-%';
    delete from public.shift_slots where id::text like 'b2810000-0000-0000-0000-%';
  commit;`);
}

function setup() {
  cleanup();
  const values = names.map((name) => {
    let starts = "clock_timestamp() + interval '4 hours'";
    let ends = "clock_timestamp() + interval '12 hours'";
    let meeting = "clock_timestamp() + interval '1 hour'";
    let status = "confirmed";
    if (name === "arrivalBefore") meeting = "clock_timestamp() + interval '4 hours'";
    if (name === "arrivalLate" || name === "adminVoid") meeting = "clock_timestamp() - interval '1 minute'";
    if (name === "ended") { starts = "clock_timestamp() - interval '5 hours'"; ends = "clock_timestamp() - interval '1 minute'"; meeting = "clock_timestamp() - interval '5 hours'"; }
    if (name === "cancelled") status = "cancelled";
    if (name === "started") { starts = "clock_timestamp() - interval '30 minutes'"; meeting = "clock_timestamp() - interval '1 hour'"; }
    if (name === "arrivalBeforeWork") { starts = "clock_timestamp() + interval '30 minutes'"; meeting = "clock_timestamp() - interval '10 minutes'"; }
    return `('${shift[name]}','${name === "foreign" || name === "adminVoid" ? job.foreign : job.own}','OCV1-04A ${name}',${starts},${ends},${meeting},1,'${status}')`;
  }).join(",\n");

  const assignments = names.map((name) => `('${assignment[name]}','${shift[name]}','${name === "foreign" || name === "adminVoid" ? worker.c : worker.a}','manager','${name === "terminal" ? "completed" : "confirmed"}')`).join(",\n");

  const planned = {
    wakeBefore: ["clock_timestamp() + interval '7 hours'", "null"],
    wakeNormal: ["clock_timestamp() + interval '1 hour'", "null"],
    wakeLate: ["clock_timestamp() - interval '1 minute'", "null"],
    departureBefore: ["null", "clock_timestamp() + interval '3 hours'"],
    departureNormal: ["null", "clock_timestamp() + interval '1 hour'"],
    departureLate: ["null", "clock_timestamp() - interval '1 minute'"],
    arrivalDownstream: ["clock_timestamp() + interval '1 hour'", "clock_timestamp() + interval '90 minutes'"],
    concurrentWake: ["clock_timestamp() + interval '1 hour'", "null"],
    departureWithoutWake: ["clock_timestamp() + interval '30 minutes'", "clock_timestamp() + interval '1 hour'"],
  };
  const confirmations = Object.entries(planned).map(([name, times]) => `('${confirmation[name]}','${assignment[name]}',true,'good',${times[0]},${times[1]})`).join(",\n");

  sql(`begin;
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status) values ${values};
    insert into public.assignments(id,shift_slot_id,worker_id,source,status) values ${assignments};
    insert into public.pre_shift_confirmations(id,assignment_id,can_work,health_status,planned_wake_at,planned_departure_at) values ${confirmations};
    insert into public.attendance_events(assignment_id,event_type,server_received_at,source)
      values ('${assignment.started}','start_work',clock_timestamp(),'worker');
  commit;`);
}

const record = (profileId, assignmentId, type, requestKey) => result(profileId, `public.record_own_assignment_journey_event('${assignmentId}','${type}','${requestKey}')`);
const voidEvent = (profileId, assignmentId, type, version, reason, requestKey) => result(profileId, `public.void_assignment_journey_event('${assignmentId}','${type}',${version},'${reason}','${requestKey}')`);

async function test() {
  pass("Wake before open is rejected", record(actor.workerA, assignment.wakeBefore, "wake", key(1)).code === "NOT_OPEN");
  const wake = record(actor.workerA, assignment.wakeNormal, "wake", key(2));
  pass("Wake normal record succeeds", wake.ok && wake.code === "RECORDED" && wake.timeliness === "early_or_on_time");
  pass("Wake same-key replay is stable", record(actor.workerA, assignment.wakeNormal, "wake", key(2)).replayed === true);
  pass("Wake duplicate different key returns canonical fact", record(actor.workerA, assignment.wakeNormal, "wake", key(3)).code === "ALREADY_RECORDED");
  pass("Wake late record is classified by DB time", record(actor.workerA, assignment.wakeLate, "wake", key(4)).timeliness === "late");
  pass("Wake missing planned time is not required", record(actor.workerA, assignment.wakeMissing, "wake", key(5)).code === "NOT_REQUIRED");

  const concurrent = await Promise.all([
    concurrentResult(actor.workerA, `public.record_own_assignment_journey_event('${assignment.concurrentWake}','wake','${key(6)}')`),
    concurrentResult(actor.workerA, `public.record_own_assignment_journey_event('${assignment.concurrentWake}','wake','${key(7)}')`),
  ]);
  pass("Concurrent Wake creates one version", concurrent.filter((value) => value.code === "RECORDED").length === 1 && concurrent.filter((value) => value.code === "ALREADY_RECORDED").length === 1);
  pass("Concurrent Wake persistence count is one", sql(`select count(*) from public.assignment_journey_event_versions where assignment_id='${assignment.concurrentWake}'`) === "1");

  pass("Departure before open is rejected", record(actor.workerA, assignment.departureBefore, "departure", key(8)).code === "NOT_OPEN");
  pass("Departure normal record succeeds", record(actor.workerA, assignment.departureNormal, "departure", key(9)).timeliness === "early_or_on_time");
  pass("Departure late record succeeds", record(actor.workerA, assignment.departureLate, "departure", key(10)).timeliness === "late");
  pass("Departure missing planned time is not required", record(actor.workerA, assignment.wakeMissing, "departure", key(11)).code === "NOT_REQUIRED");
  pass("Missing Wake does not block Departure", record(actor.workerA, assignment.departureWithoutWake, "departure", key(12)).code === "RECORDED");
  pass("Departure record does not synthesize Wake", sql(`select count(*) from public.assignment_journey_event_versions where assignment_id='${assignment.departureWithoutWake}' and journey_type='wake'`) === "0");

  pass("Arrival before open is rejected", record(actor.workerA, assignment.arrivalBefore, "arrival", key(13)).code === "NOT_OPEN");
  const arrival = record(actor.workerA, assignment.arrivalNormal, "arrival", key(14));
  pass("Arrival normal record succeeds", arrival.ok && arrival.timeliness === "early_or_on_time");
  pass("Arrival retry is stable", record(actor.workerA, assignment.arrivalNormal, "arrival", key(14)).replayed === true);
  pass("Arrival late record succeeds", record(actor.workerA, assignment.arrivalLate, "arrival", key(15)).timeliness === "late");
  pass("Arrival remains independent before start_work", record(actor.workerA, assignment.arrivalBeforeWork, "arrival", key(16)).code === "RECORDED");
  const startWork = sql(roleSql(actor.workerA, `select public.record_worker_start_work('${assignment.arrivalBeforeWork}')::text`));
  pass("Attendance start_work still records after Arrival", Boolean(startWork));
  pass("start_work does not synthesize Arrival", sql(`select count(*) from public.assignment_journey_event_versions where assignment_id='${assignment.started}' and journey_type='arrival'`) === "0");
  pass("Arrival after start_work is superseded", record(actor.workerA, assignment.started, "arrival", key(17)).code === "SUPERSEDED");
  pass("Arrival closes at Shift end", record(actor.workerA, assignment.ended, "arrival", key(18)).code === "CLOSED");

  pass("Arrival downstream records", record(actor.workerA, assignment.arrivalDownstream, "arrival", key(19)).code === "RECORDED");
  pass("Arrival supersedes missing Wake", record(actor.workerA, assignment.arrivalDownstream, "wake", key(20)).code === "SUPERSEDED");
  pass("Arrival supersedes missing Departure", record(actor.workerA, assignment.arrivalDownstream, "departure", key(21)).code === "SUPERSEDED");
  pass("Cancelled Shift is closed", record(actor.workerA, assignment.cancelled, "arrival", key(22)).code === "CLOSED");
  pass("Terminal Assignment is closed", record(actor.workerA, assignment.terminal, "arrival", key(23)).code === "CLOSED");
  pass("Foreign Worker Assignment is safely hidden", record(actor.workerA, assignment.foreign, "arrival", key(24)).code === "NOT_FOUND");

  const toVoid = record(actor.workerA, assignment.voidRerecord, "arrival", key(25));
  const voided = voidEvent(actor.manager, assignment.voidRerecord, "arrival", toVoid.version, "wrong tap", key(26));
  pass("Manager own Branch can append void", voided.ok && voided.version === 2);
  pass("Void preserves original history", sql(`select string_agg(operation,',' order by version) from public.assignment_journey_event_versions where assignment_id='${assignment.voidRerecord}' and journey_type='arrival'`) === "recorded,voided");
  pass("Void retry is stable", voidEvent(actor.manager, assignment.voidRerecord, "arrival", toVoid.version, "wrong tap", key(26)).replayed === true);
  const rerecord = record(actor.workerA, assignment.voidRerecord, "arrival", key(27));
  pass("Worker can re-record after void while eligible", rerecord.ok && rerecord.version === 3);
  pass("Versions remain contiguous", sql(`select string_agg(version::text,',' order by version) from public.assignment_journey_event_versions where assignment_id='${assignment.voidRerecord}'`) === "1,2,3");
  pass("Stale expected version is rejected", voidEvent(actor.manager, assignment.voidRerecord, "arrival", 1, "stale", key(28)).code === "VERSION_CONFLICT");
  pass("Worker cannot void", voidEvent(actor.workerA, assignment.voidRerecord, "arrival", 3, "worker attempt", key(29)).code === "FORBIDDEN");

  const foreignFact = record(actor.workerC, assignment.adminVoid, "arrival", key(30));
  pass("Foreign Branch Worker can record own fact", foreignFact.ok);
  pass("Manager foreign Branch correction is safely denied", voidEvent(actor.manager, assignment.adminVoid, "arrival", 1, "foreign", key(31)).code === "NOT_FOUND");
  pass("System Admin can correct organization-wide", voidEvent(actor.admin, assignment.adminVoid, "arrival", 1, "admin correction", key(32)).ok === true);

  const idempotency = record(actor.workerA, assignment.wakeNormal, "departure", key(2));
  pass("Same record key with different fingerprint conflicts", idempotency.code === "IDEMPOTENCY_CONFLICT");
  const voidConflict = voidEvent(actor.manager, assignment.voidRerecord, "wake", 3, "wrong tap", key(26));
  pass("Same void key with different fingerprint conflicts", voidConflict.code === "IDEMPOTENCY_CONFLICT");

  const directInsert = sql(roleSql(actor.workerA, `insert into public.assignment_journey_event_versions(assignment_id,journey_type,version,operation,occurred_at,timeliness,actor_profile_id,actor_category,idempotency_key,request_snapshot) values('${assignment.wakeMissing}','arrival',1,'recorded',now(),'late','${actor.workerA}','worker','${key(40)}','{}')`), true);
  pass("Direct table INSERT is denied", /permission denied/i.test(directInsert));
  const directUpdate = sql(roleSql(actor.manager, `update public.assignment_journey_event_versions set correction_reason='tamper' where assignment_id='${assignment.voidRerecord}'`), true);
  pass("Runtime UPDATE is denied", /permission denied/i.test(directUpdate));
  const directDelete = sql(roleSql(actor.admin, `delete from public.assignment_journey_event_versions where assignment_id='${assignment.voidRerecord}'`), true);
  pass("Runtime DELETE is denied", /permission denied/i.test(directDelete));
  const anon = sql(roleSql("00000000-0000-0000-0000-000000000000", `select public.record_own_assignment_journey_event('${assignment.wakeMissing}','arrival','${key(41)}')`, "anon"), true);
  pass("anon cannot execute Worker command", /permission denied/i.test(anon));
  const service = sql(roleSql(actor.workerA, `select public.record_own_assignment_journey_event('${assignment.wakeMissing}','arrival','${key(42)}')`, "service_role"), true);
  pass("service_role has no product command grant", /permission denied/i.test(service));
  pass("Commands did not mutate Assignment lifecycle", sql(`select count(*) from public.assignments where id::text like 'b2820000-0000-0000-0000-%' and status not in ('confirmed','completed')`) === "0");
  pass("Journey commands did not create Placement facts", sql(`select count(*) from public.assignment_placement_segments where assignment_id::text like 'b2820000-0000-0000-0000-%'`) === "0");
  pass("Only explicit attendance setup/start command changed Attendance", sql(`select count(*) from public.attendance_events where assignment_id::text like 'b2820000-0000-0000-0000-%'`) === "2");
  pass("Journey table contains only frozen vocabulary", sql("select count(*) from public.assignment_journey_event_versions where journey_type not in ('wake','departure','arrival')") === "0");
  pass("RPCs are hardened SECURITY DEFINER functions", sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('record_own_assignment_journey_event','void_assignment_journey_event') and p.prosecdef and p.proconfig @> array['search_path=\"\"']") === "2");
}

try {
  setup();
  await test();
} finally {
  cleanup();
}

pass("Dedicated OCV1-04A fixtures cleaned", sql("select (select count(*) from public.shift_slots where id::text like 'b2810000-0000-0000-0000-%') + (select count(*) from public.assignment_journey_event_versions where assignment_id::text like 'b2820000-0000-0000-0000-%')") === "0");
console.log(`Worker Journey Facts final: ${passed}/${passed} passed`);
