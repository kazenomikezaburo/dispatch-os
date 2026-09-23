import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const actors = {
  workerA: "a0000000-0000-0000-0000-000000000001",
  workerB: "a0000000-0000-0000-0000-000000000002",
  workerC: "a0000000-0000-0000-0000-000000000003",
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const workers = {
  a: "c0000000-0000-0000-0000-000000000001",
  b: "c0000000-0000-0000-0000-000000000002",
  c: "c0000000-0000-0000-0000-000000000003",
};
const jobs = {
  own: "10000000-0000-0000-0000-000000000001",
  foreign: "10000000-0000-0000-0000-000000000003",
};
const shift = (suffix) => `e2000000-0000-0000-0000-${suffix.padStart(12, "0")}`;
const shifts = {
  unknown: shift("1"), full: shift("2"), consultable: shift("3"), partial: shift("4"),
  unavailable: shift("5"), adjacent: shift("6"), overnight: shift("7"),
  preferenceMatched: shift("8"), preferencePartial: shift("9"), preferenceMissed: shift("10"),
  assignmentSource: shift("11"), assignmentOverlap: shift("12"), assignmentTouching: shift("13"),
  foreign: shift("14"), correction: shift("15"),
};
const assignmentId = "e2100000-0000-0000-0000-000000000001";
const applicationId = "e2200000-0000-0000-0000-000000000001";

function run(sql, { allowFailure = false } = {}) {
  try {
    return execFileSync("docker", dockerArgs, { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    throw error;
  }
}

function roleSql(profileId, body, role = "authenticated") {
  return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; ${body} commit;`;
}

function scalar(sql) {
  return run(sql).split(/\r?\n/).at(-1);
}

function asActor(profileId, expression) {
  return scalar(roleSql(profileId, `select (${expression})::text;`));
}

function facts(profileId, workerId, shiftId) {
  return JSON.parse(asActor(profileId, `public.get_worker_shift_availability_facts('${workerId}','${shiftId}')`));
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
    delete from public.shift_applications where id='${applicationId}';
    delete from public.assignments where id='${assignmentId}';
    delete from public.shift_slots where id::text like 'e2000000-0000-0000-0000-%';
    delete from public.worker_availability_intervals where starts_at >= '2098-01-01T00:00:00Z' and starts_at < '2098-02-01T00:00:00Z';
    delete from public.worker_work_conditions where worker_id in ('${workers.a}','${workers.b}','${workers.c}');
    update public.workers set status='active' where id in ('${workers.a}','${workers.b}','${workers.c}');
  commit;`);
}

try {
  cleanup();

  pass("both STAFF-2E tables have RLS", scalar(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('worker_availability_intervals','worker_work_conditions') and c.relrowsecurity;`) === "2");
  pass("runtime roles have no direct table mutation", scalar(`select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('worker_availability_intervals','worker_work_conditions') and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');`) === "0");
  pass("all public STAFF-2E commands and reader are hardened", scalar(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_own_availability_interval','retire_own_availability_interval','correct_own_availability_interval','set_own_work_conditions','get_worker_shift_availability_facts') and p.prosecdef and p.proconfig @> array['search_path=""'];`) === "5");

  run(`insert into public.shift_slots(id,job_id,label,starts_at,ends_at,required_workers,status) values
    ('${shifts.unknown}','${jobs.own}','S2E unknown','2098-01-05T00:00:00Z','2098-01-05T02:00:00Z',1,'recruiting'),
    ('${shifts.full}','${jobs.own}','S2E full','2098-01-06T00:00:00Z','2098-01-06T04:00:00Z',1,'recruiting'),
    ('${shifts.consultable}','${jobs.own}','S2E consultable','2098-01-07T00:00:00Z','2098-01-07T04:00:00Z',1,'recruiting'),
    ('${shifts.partial}','${jobs.own}','S2E partial','2098-01-08T00:00:00Z','2098-01-08T04:00:00Z',1,'recruiting'),
    ('${shifts.unavailable}','${jobs.own}','S2E unavailable','2098-01-09T00:00:00Z','2098-01-09T04:00:00Z',1,'recruiting'),
    ('${shifts.adjacent}','${jobs.own}','S2E adjacent','2098-01-10T00:00:00Z','2098-01-10T04:00:00Z',1,'recruiting'),
    ('${shifts.overnight}','${jobs.own}','S2E overnight','2098-01-03T14:00:00Z','2098-01-03T18:00:00Z',1,'recruiting'),
    ('${shifts.preferenceMatched}','${jobs.own}','S2E preference matched','2098-01-01T15:30:00Z','2098-01-01T17:30:00Z',1,'recruiting'),
    ('${shifts.preferencePartial}','${jobs.own}','S2E preference partial','2098-01-01T17:00:00Z','2098-01-01T19:00:00Z',1,'recruiting'),
    ('${shifts.preferenceMissed}','${jobs.own}','S2E preference missed','2098-01-01T19:00:00Z','2098-01-01T20:00:00Z',1,'recruiting'),
    ('${shifts.assignmentSource}','${jobs.own}','S2E assignment source','2098-01-12T00:00:00Z','2098-01-12T02:00:00Z',1,'confirmed'),
    ('${shifts.assignmentOverlap}','${jobs.own}','S2E assignment overlap','2098-01-12T01:00:00Z','2098-01-12T03:00:00Z',1,'recruiting'),
    ('${shifts.assignmentTouching}','${jobs.own}','S2E assignment touching','2098-01-12T02:00:00Z','2098-01-12T04:00:00Z',1,'recruiting'),
    ('${shifts.foreign}','${jobs.foreign}','S2E foreign','2098-01-14T00:00:00Z','2098-01-14T02:00:00Z',1,'recruiting'),
    ('${shifts.correction}','${jobs.own}','S2E correction','2098-01-15T00:00:00Z','2098-01-15T04:00:00Z',1,'recruiting');
    insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by)
    values('${assignmentId}','${shifts.assignmentSource}','${workers.a}','manager','assigned','${actors.manager}');
    insert into public.shift_applications(id,shift_slot_id,worker_id,status)
    values('${applicationId}','${shifts.unknown}','${workers.a}','applied');`);

  const fullId = asActor(actors.workerA, `public.create_own_availability_interval('available','2098-01-06T00:00:00Z','2098-01-06T04:00:00Z')`);
  asActor(actors.workerA, `public.create_own_availability_interval('consultable','2098-01-07T00:00:00Z','2098-01-07T04:00:00Z')`);
  asActor(actors.workerA, `public.create_own_availability_interval('available','2098-01-08T00:00:00Z','2098-01-08T02:00:00Z')`);
  asActor(actors.workerA, `public.create_own_availability_interval('unavailable','2098-01-09T01:00:00Z','2098-01-09T02:00:00Z')`);
  asActor(actors.workerA, `public.create_own_availability_interval('available','2098-01-10T00:00:00Z','2098-01-10T02:00:00Z')`);
  asActor(actors.workerA, `public.create_own_availability_interval('available','2098-01-10T02:00:00Z','2098-01-10T04:00:00Z')`);
  asActor(actors.workerA, `public.create_own_availability_interval('available','2098-01-03T14:00:00Z','2098-01-03T18:00:00Z')`);
  const correctionId = asActor(actors.workerA, `public.create_own_availability_interval('available','2098-01-15T00:00:00Z','2098-01-15T02:00:00Z')`);
  const workerBInterval = asActor(actors.workerB, `public.create_own_availability_interval('available','2098-01-20T00:00:00Z','2098-01-20T02:00:00Z')`);
  asActor(actors.workerC, `public.create_own_availability_interval('available','2098-01-14T00:00:00Z','2098-01-14T02:00:00Z')`);
  pass("Worker-owned create derives Worker and actor from auth", scalar(`select (worker_id='${workers.a}')::text||'|'||(created_by_profile_id='${actors.workerA}')::text from public.worker_availability_intervals where id='${fullId}';`) === "true|true");

  const overlapRejected = run(roleSql(actors.workerA, `select public.create_own_availability_interval('unavailable','2098-01-06T01:00:00Z','2098-01-06T02:00:00Z');`), { allowFailure: true });
  pass("overlapping active Availability is rejected", overlapRejected.includes("worker_availability_intervals_active_time_excl"));
  pass("adjacent Availability intervals are accepted", scalar(`select count(*) from public.worker_availability_intervals where worker_id='${workers.a}' and starts_at >= '2098-01-10T00:00:00Z' and ends_at <= '2098-01-10T04:00:00Z' and retired_at is null;`) === "2");

  const corrected = JSON.parse(asActor(actors.workerA, `public.correct_own_availability_interval('${correctionId}','consultable','2098-01-15T00:00:00Z','2098-01-15T04:00:00Z')`));
  pass("correction atomically retires old fact and creates replacement", corrected.retiredIntervalId === correctionId && scalar(`select count(*) filter(where retired_at is not null)||'|'||count(*) filter(where retired_at is null) from public.worker_availability_intervals where id in ('${correctionId}','${corrected.replacementIntervalId}');`) === "1|1");
  const failedCorrection = run(roleSql(actors.workerA, `select public.correct_own_availability_interval('${fullId}','available','2098-01-08T01:00:00Z','2098-01-08T03:00:00Z');`), { allowFailure: true });
  pass("failed replacement rolls back retirement atomically", failedCorrection.includes("worker_availability_intervals_active_time_excl") && scalar(`select (retired_at is null)::text from public.worker_availability_intervals where id='${fullId}';`) === "true");
  const identityMutation = run(`update public.worker_availability_intervals set starts_at=starts_at+interval '1 minute' where id='${fullId}';`, { allowFailure: true });
  pass("Availability identity is immutable after creation", identityMutation.includes("availability_identity_immutable"));
  const foreignRetire = run(roleSql(actors.workerA, `select public.retire_own_availability_interval('${workerBInterval}');`), { allowFailure: true });
  pass("Worker cannot retire another Worker's interval", foreignRetire.includes("availability_interval_unavailable"));
  const ownRetire = JSON.parse(asActor(actors.workerB, `public.retire_own_availability_interval('${workerBInterval}')`));
  pass("Worker retires own fact without hard delete", ownRetire.retired === true && scalar(`select (retired_at is not null)::text from public.worker_availability_intervals where id='${workerBInterval}';`) === "true");

  const unknown = facts(actors.manager, workers.a, shifts.unknown);
  const full = facts(actors.manager, workers.a, shifts.full);
  const consultable = facts(actors.manager, workers.a, shifts.consultable);
  const partial = facts(actors.manager, workers.a, shifts.partial);
  const unavailable = facts(actors.manager, workers.a, shifts.unavailable);
  const adjacent = facts(actors.manager, workers.a, shifts.adjacent);
  const overnight = facts(actors.manager, workers.a, shifts.overnight);
  pass("no Availability record returns eligible unknown", unknown.availabilityEligible && unknown.availabilityState === "unknown" && unknown.availabilityCoverage === "none");
  pass("full available coverage is confirmed", full.availabilityEligible && full.availabilityState === "explicitly_available" && full.availabilityCoverage === "full");
  pass("full consultable coverage requires consultation", consultable.availabilityEligible && consultable.availabilityState === "consultation_required");
  pass("partial available coverage remains eligible but unconfirmed", partial.availabilityEligible && partial.availabilityState === "partially_available" && partial.availabilityCoverage === "partial");
  pass("partial unavailable overlap is ineligible", !unavailable.availabilityEligible && unavailable.availabilityState === "explicitly_unavailable" && unavailable.availabilityCoverage === "partial");
  pass("adjacent intervals form full half-open coverage", adjacent.availabilityState === "explicitly_available" && adjacent.availabilityCoverage === "full");
  pass("Shift crossing midnight uses absolute interval coverage", overnight.availabilityState === "explicitly_available" && overnight.availabilityCoverage === "full");

  asActor(actors.workerA, `public.set_own_work_conditions(array[3,3]::smallint[],'23:00','03:00',true,'  Nagoya  ','  Reception  ','  Train  ',true)`);
  pass("Work Conditions normalize weekdays and informational notes", scalar(`select preferred_iso_weekdays::text||'|'||preferred_area_note||'|'||preferred_work_category_note||'|'||transport_preference_note from public.worker_work_conditions where worker_id='${workers.a}';`) === "{3}|Nagoya|Reception|Train");
  const badWeekday = run(roleSql(actors.workerA, `select public.set_own_work_conditions(array[0]::smallint[],null,null,false,null,null,null,true);`), { allowFailure: true });
  pass("invalid ISO weekday is rejected", badWeekday.includes("invalid_preferred_iso_weekday"));
  const badTime = run(roleSql(actors.workerA, `select public.set_own_work_conditions(array[4]::smallint[],'09:00','08:00',false,null,null,null,true);`), { allowFailure: true });
  pass("invalid non-overnight preference window is rejected", badTime.includes("worker_work_conditions_time_shape_check"));

  const prefMatched = facts(actors.manager, workers.a, shifts.preferenceMatched);
  const prefPartial = facts(actors.manager, workers.a, shifts.preferencePartial);
  const prefMissed = facts(actors.manager, workers.a, shifts.preferenceMissed);
  const prefNone = facts(actors.manager, workers.b, shifts.unknown);
  pass("Tokyo boundary and overnight preference fully match", prefMatched.preferenceMatches.preferredSchedule === "matched" && prefMatched.evaluatedInterval.timeZone === "Asia/Tokyo");
  pass("overnight preference partial overlap is informational", prefPartial.preferenceMatches.preferredSchedule === "partially_matched" && prefPartial.availabilityEligible);
  pass("preference non-match never hard-filters Availability", prefMissed.preferenceMatches.preferredSchedule === "not_matched" && prefMissed.availabilityEligible);
  pass("missing Work Conditions are not configured", prefNone.preferenceMatches.preferredSchedule === "not_configured");
  pass("area/category/transport remain informational only", prefMatched.preferenceMatches.preferredArea === "informational_only" && prefMatched.preferenceMatches.preferredWorkCategory === "informational_only" && prefMatched.preferenceMatches.transport === "informational_only");

  const overlap = facts(actors.manager, workers.a, shifts.assignmentOverlap);
  const touching = facts(actors.manager, workers.a, shifts.assignmentTouching);
  pass("overlapping active Assignment is derived as conflict", !overlap.overlapEligible && overlap.overlapReasonCodes[0] === "assignment_time_conflict" && overlap.conflictingAssignments[0].assignmentId === assignmentId);
  pass("touching Assignment intervals are not conflicts", touching.overlapEligible && touching.conflictingAssignments.length === 0);

  run(`update public.workers set status='inactive' where id='${workers.b}';`);
  const inactive = facts(actors.manager, workers.b, shifts.unknown);
  pass("inactive Worker is independently ineligible", !inactive.workerStatusEligible && inactive.workerStatusReasonCodes[0] === "worker_inactive");
  run(`update public.workers set status='suspended' where id='${workers.b}';`);
  const suspended = facts(actors.manager, workers.b, shifts.unknown);
  pass("suspended Worker is independently ineligible", !suspended.workerStatusEligible && suspended.workerStatusReasonCodes[0] === "worker_suspended");
  run(`update public.workers set status='active' where id='${workers.b}';`);

  pass("Worker reads own Availability only", asActor(actors.workerA, `(select count(*) from public.worker_availability_intervals)`) === "9");
  pass("Manager reads own-Branch Worker facts only", asActor(actors.manager, `(select count(*) from public.worker_availability_intervals where starts_at >= '2098-01-01')`) === "10");
  const managerForeign = facts(actors.manager, workers.c, shifts.foreign);
  pass("Manager foreign-Branch fact read is safe unavailable", managerForeign.sourceAvailable === false);
  const adminForeign = facts(actors.admin, workers.c, shifts.foreign);
  pass("System Admin reads organization Worker and Shift facts", adminForeign.sourceAvailable && adminForeign.availabilityState === "explicitly_available");
  const workerOwnFacts = facts(actors.workerA, workers.a, shifts.unknown);
  pass("Worker reads own authorized Shift facts", workerOwnFacts.sourceAvailable && workerOwnFacts.workerId === workers.a);
  const workerForeignFacts = facts(actors.workerA, workers.b, shifts.unknown);
  pass("Worker cannot read another Worker's facts", workerForeignFacts.sourceAvailable === false);
  const adminMutation = run(roleSql(actors.admin, `select public.create_own_availability_interval('available','2098-01-25','2098-01-26');`), { allowFailure: true });
  pass("Admin receives no Availability override mutation", adminMutation.includes("worker_availability_forbidden"));
  const directWrite = run(roleSql(actors.workerA, `insert into public.worker_availability_intervals(worker_id,kind,starts_at,ends_at,created_by_profile_id) values('${workers.a}','available','2098-01-25','2098-01-26','${actors.workerA}');`), { allowFailure: true });
  pass("authenticated direct Availability write is denied", directWrite.includes("permission denied"));
  const anonRead = run(`begin; set local role anon; select count(*) from public.worker_availability_intervals; commit;`, { allowFailure: true });
  const anonRpc = run(`begin; set local role anon; select public.get_worker_shift_availability_facts('${workers.a}','${shifts.unknown}'); commit;`, { allowFailure: true });
  pass("anon table read and fact RPC are denied", anonRead.includes("permission denied") && anonRpc.includes("permission denied"));
  pass("availability reader does not compose requirementsEligible", !("requirementsEligible" in unknown) && !("placementEligible" in unknown));

  cleanup();
  pass("STAFF-2E fixtures are fully cleaned", scalar(`select (select count(*) from public.worker_availability_intervals where starts_at >= '2098-01-01' and starts_at < '2098-02-01') + (select count(*) from public.shift_slots where id::text like 'e2000000-0000-0000-0000-%') + (select count(*) from public.worker_work_conditions where worker_id in ('${workers.a}','${workers.b}','${workers.c}'));`) === "0");
  console.log(`Availability / Work Conditions: ${passed}/${passed} passed`);
} finally {
  cleanup();
}
