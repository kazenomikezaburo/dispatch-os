import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const actor = { worker: "a0000000-0000-0000-0000-000000000001", foreign: "a0000000-0000-0000-0000-000000000003", manager: "a0000000-0000-0000-0000-000000000004" };
const worker = { own: "c0000000-0000-0000-0000-000000000001", foreign: "c0000000-0000-0000-0000-000000000003" };
const job = { own: "10000000-0000-0000-0000-000000000001", foreign: "10000000-0000-0000-0000-000000000003" };
const id = (kind, n) => `b29${kind}0000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const shift = { planned: id("1", 1), missing: id("1", 2), foreign: id("1", 3), voided: id("1", 4) };
const assignment = { planned: id("2", 1), missing: id("2", 2), foreign: id("2", 3), voided: id("2", 4) };
const key = (n) => id("9", n);
let passed = 0;

function sql(statement, allowFailure = false) {
  try { return execFileSync("docker", psql, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (error) { if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`; throw error; }
}
function roleSql(profileId, statement, role = "authenticated") { return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; ${statement}; commit;`; }
function json(profileId, expression, role = "authenticated") { return JSON.parse(sql(roleSql(profileId, `select (${expression})::text`, role)).split(/\r?\n/).at(-1)); }
function rows(profileId, ids) { const value = sql(roleSql(profileId, `select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)::text from public.get_own_assignment_journey_facts(array[${ids.map((value) => `'${value}'::uuid`).join(",")}]) as f`)); return JSON.parse(value.split(/\r?\n/).at(-1)); }
function pass(name, condition) { assert.ok(condition, name); passed += 1; console.log(`PASS ${name}`); }
function cleanup() { sql(`begin; delete from public.assignment_journey_event_versions where assignment_id::text like 'b2920000-0000-0000-0000-%'; delete from public.pre_shift_confirmations where assignment_id::text like 'b2920000-0000-0000-0000-%'; delete from public.assignments where id::text like 'b2920000-0000-0000-0000-%'; delete from public.shift_slots where id::text like 'b2910000-0000-0000-0000-%'; commit;`); }

try {
  cleanup();
  sql(`begin;
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status) values
      ('${shift.planned}','${job.own}','04B planned',clock_timestamp()+interval '4 hours',clock_timestamp()+interval '12 hours',clock_timestamp()+interval '3 hours',1,'confirmed'),
      ('${shift.missing}','${job.own}','04B missing',clock_timestamp()+interval '5 hours',clock_timestamp()+interval '13 hours',clock_timestamp()+interval '4 hours',1,'confirmed'),
      ('${shift.foreign}','${job.foreign}','04B foreign',clock_timestamp()+interval '4 hours',clock_timestamp()+interval '12 hours',clock_timestamp()+interval '3 hours',1,'confirmed'),
      ('${shift.voided}','${job.own}','04B voided',clock_timestamp()+interval '4 hours',clock_timestamp()+interval '12 hours',clock_timestamp()+interval '3 hours',1,'confirmed');
    insert into public.assignments(id,shift_slot_id,worker_id,source,status) values
      ('${assignment.planned}','${shift.planned}','${worker.own}','manager','confirmed'),
      ('${assignment.missing}','${shift.missing}','${worker.own}','manager','confirmed'),
      ('${assignment.foreign}','${shift.foreign}','${worker.foreign}','manager','confirmed'),
      ('${assignment.voided}','${shift.voided}','${worker.own}','manager','confirmed');
  commit;`);

  const submit = (assignmentId, wake, departure) => json(actor.worker, `public.submit_own_pre_shift_confirmation('${assignmentId}',true,'good',${wake},${departure})`);
  const valid = submit(assignment.planned, "clock_timestamp()+interval '1 hour'", "clock_timestamp()+interval '2 hours'");
  pass("valid Wake and Departure plans submit atomically", valid.ok && valid.code === "SUBMITTED");
  pass("plans are stored only on immutable confirmation", sql(`select count(*) from public.pre_shift_confirmations where assignment_id='${assignment.planned}' and planned_wake_at is not null and planned_departure_at is not null`) === "1");
  pass("duplicate confirmation is rejected", submit(assignment.planned, "null", "null").code === "ALREADY_SUBMITTED");
  pass("invalid plan ordering is rejected", submit(assignment.missing, "clock_timestamp()+interval '2 hours'", "clock_timestamp()+interval '1 hour'").code === "INVALID_PLANNED_TIME");
  pass("past planned time is rejected", submit(assignment.missing, "clock_timestamp()-interval '1 minute'", "null").code === "INVALID_PLANNED_TIME");
  pass("plan after arrival target is rejected", submit(assignment.missing, "null", "clock_timestamp()+interval '6 hours'").code === "INVALID_PLANNED_TIME");
  pass("missing plans remain valid", submit(assignment.missing, "null", "null").ok === true);
  pass("foreign Assignment is safely unavailable", submit(assignment.foreign, "null", "null").code === "NOT_FOUND");

  sql(`insert into public.pre_shift_confirmations(assignment_id,can_work,health_status) values('${assignment.voided}',true,'good');
    insert into public.assignment_journey_event_versions(assignment_id,journey_type,version,operation,occurred_at,timeliness,actor_profile_id,actor_category,idempotency_key,request_snapshot)
    values('${assignment.voided}','arrival',1,'recorded',clock_timestamp(),'early_or_on_time','${actor.worker}','worker','${key(1)}','{"command":"record"}');
    insert into public.assignment_journey_event_versions(assignment_id,journey_type,version,operation,actor_profile_id,actor_category,idempotency_key,request_snapshot,correction_reason)
    values('${assignment.voided}','arrival',2,'voided','${actor.manager}','manager','${key(2)}','{"command":"void"}','private correction');`);

  const own = rows(actor.worker, [assignment.planned, assignment.missing, assignment.foreign, assignment.voided]);
  pass("projection returns only own Assignments", own.length === 3 && !own.some((row) => row.assignment_id === assignment.foreign));
  pass("projection uses highest journey version", own.find((row) => row.assignment_id === assignment.voided)?.arrival_operation === "voided");
  pass("projection redacts correction details and internal event IDs", own.every((row) => !("correction_reason" in row) && !("request_snapshot" in row) && !("actor_profile_id" in row) && !("event_id" in row)));
  pass("projection supplies DB-generated current time", own.every((row) => typeof row.generated_at === "string"));
  pass("missing plans remain null in projection", own.find((row) => row.assignment_id === assignment.missing)?.planned_wake_at === null);
  pass("foreign-only projection is empty", rows(actor.worker, [assignment.foreign]).length === 0);
  pass("bounded reader rejects more than 50 IDs", rows(actor.worker, Array.from({ length: 51 }, () => assignment.planned)).length === 0);

  const directUpdate = sql(roleSql(actor.worker, `update public.pre_shift_confirmations set planned_wake_at=now() where assignment_id='${assignment.planned}'`), true);
  pass("confirmation remains immutable after submission", /permission denied/i.test(directUpdate));
  const invalidDirectInsert = sql(roleSql(actor.worker, `insert into public.pre_shift_confirmations(assignment_id,can_work,health_status,planned_wake_at) values('${assignment.voided}',true,'good',clock_timestamp()-interval '1 minute')`), true);
  pass("legacy direct insert path also rejects invalid planned time", /pre_shift_planned_time_invalid/i.test(invalidDirectInsert));
  pass("existing Worker confirmation INSERT grant is preserved", sql("select has_table_privilege('authenticated','public.pre_shift_confirmations','insert')") === "t");
  const directJourneyRead = sql(roleSql(actor.worker, "select count(*) from public.assignment_journey_event_versions"), true);
  pass("Worker cannot directly read journey history table", /permission denied/i.test(directJourneyRead));
  const anonReader = sql(roleSql("00000000-0000-0000-0000-000000000000", `select * from public.get_own_assignment_journey_facts(array['${assignment.planned}'::uuid])`, "anon"), true);
  pass("anon cannot execute projection", /permission denied/i.test(anonReader));
  const managerReader = rows(actor.manager, [assignment.planned]);
  pass("Manager cannot use Worker projection", managerReader.length === 0);
  pass("RPCs are authenticated-only hardened functions", sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_own_pre_shift_confirmation','get_own_assignment_journey_facts') and p.prosecdef and p.proconfig @> array['search_path=\"\"'] and has_function_privilege('authenticated',p.oid,'execute') and not has_function_privilege('anon',p.oid,'execute')") === "2");
} finally {
  cleanup();
}
pass("dedicated OCV1-04B fixtures cleaned", sql("select (select count(*) from public.shift_slots where id::text like 'b2910000-0000-0000-0000-%') + (select count(*) from public.assignment_journey_event_versions where assignment_id::text like 'b2920000-0000-0000-0000-%')") === "0");
console.log(`Worker Journey Projection DB final: ${passed}/${passed} passed`);
