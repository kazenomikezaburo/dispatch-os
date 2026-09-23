import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const actors = {
  worker: "a0000000-0000-0000-0000-000000000001",
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const workers = {
  own: "c0000000-0000-0000-0000-000000000001",
  foreign: "c0000000-0000-0000-0000-000000000003",
};
const jobs = {
  own: "10000000-0000-0000-0000-000000000001",
  foreign: "10000000-0000-0000-0000-000000000003",
};
const shift = (suffix) => `f2000000-0000-0000-0000-${suffix.padStart(12, "0")}`;
const shifts = {
  unknown: shift("1"), partial: shift("2"), consultable: shift("3"),
  unavailable: shift("4"), expired: shift("5"), conflictSource: shift("6"),
  conflictTarget: shift("7"), multiple: shift("8"), foreign: shift("9"),
  multipleConflict: shift("10"),
};
const assignmentIds = {
  conflict: "f2100000-0000-0000-0000-000000000001",
  multiple: "f2100000-0000-0000-0000-000000000002",
};

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

function candidate(profileId, workerId, shiftId) {
  return JSON.parse(asActor(profileId, `public.get_worker_shift_candidate_eligibility('${workerId}','${shiftId}')`));
}

function codes(items) {
  return items.map((item) => item.code);
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
    delete from public.assignments where id in ('${assignmentIds.conflict}','${assignmentIds.multiple}');
    delete from public.worker_availability_intervals
      where starts_at >= '2099-01-01T00:00:00Z' and starts_at < '2099-02-01T00:00:00Z';
    delete from public.worker_work_conditions where worker_id='${workers.own}';
    delete from public.job_skill_requirements where skill_id in (
      select id from public.skills where code like 'S2F-%'
    );
    delete from public.job_qualification_requirements where qualification_id in (
      select id from public.qualifications where code like 'S2F-%'
    );
    delete from public.worker_skills where skill_id in (
      select id from public.skills where code like 'S2F-%'
    );
    delete from public.worker_qualifications where qualification_id in (
      select id from public.qualifications where code like 'S2F-%'
    );
    delete from public.shift_slots where id::text like 'f2000000-0000-0000-0000-%';
    delete from public.qualifications where code like 'S2F-%';
    delete from public.skills where code like 'S2F-%';
    update public.workers set status='active' where id='${workers.own}';
  commit;`);
}

try {
  cleanup();

  pass("candidate reader is hardened", scalar(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_worker_shift_candidate_eligibility' and p.prosecdef and p.provolatile='s' and p.proconfig @> array['search_path=""'];`) === "1");
  pass("only authenticated can execute candidate reader", scalar(`select has_function_privilege('authenticated','public.get_worker_shift_candidate_eligibility(uuid,uuid)','execute')::text||'|'||has_function_privilege('anon','public.get_worker_shift_candidate_eligibility(uuid,uuid)','execute')::text||'|'||has_function_privilege('service_role','public.get_worker_shift_candidate_eligibility(uuid,uuid)','execute')::text;`) === "true|false|false");

  const skillId = asActor(actors.admin, `public.create_skill_master('S2F-SKILL','Candidate skill',null)`);
  const qualificationId = asActor(actors.admin, `public.create_qualification_master('S2F-QUALIFICATION','Candidate qualification',null,'required')`);
  asActor(actors.manager, `public.add_job_skill_requirement('${jobs.own}','${skillId}')`);
  asActor(actors.manager, `public.add_job_qualification_requirement('${jobs.own}','${qualificationId}')`);
  asActor(actors.admin, `public.set_worker_skill_holding('${workers.own}','${skillId}',null,true)`);
  asActor(actors.admin, `public.set_worker_qualification_holding('${workers.own}','${qualificationId}','S2F-SECRET',null,'2098-01-01','2099-01-15',null)`);

  run(`insert into public.shift_slots(id,job_id,label,starts_at,ends_at,required_workers,status) values
    ('${shifts.unknown}','${jobs.own}','S2F unknown','2099-01-05T00:00:00Z','2099-01-05T04:00:00Z',1,'recruiting'),
    ('${shifts.partial}','${jobs.own}','S2F partial','2099-01-06T00:00:00Z','2099-01-06T04:00:00Z',1,'recruiting'),
    ('${shifts.consultable}','${jobs.own}','S2F consultable','2099-01-07T00:00:00Z','2099-01-07T04:00:00Z',1,'recruiting'),
    ('${shifts.unavailable}','${jobs.own}','S2F unavailable','2099-01-08T00:00:00Z','2099-01-08T04:00:00Z',1,'recruiting'),
    ('${shifts.expired}','${jobs.own}','S2F expired','2099-01-20T00:00:00Z','2099-01-20T04:00:00Z',1,'recruiting'),
    ('${shifts.conflictSource}','${jobs.own}','S2F conflict source','2099-01-10T00:00:00Z','2099-01-10T03:00:00Z',1,'confirmed'),
    ('${shifts.conflictTarget}','${jobs.own}','S2F conflict target','2099-01-10T02:00:00Z','2099-01-10T05:00:00Z',1,'recruiting'),
    ('${shifts.multiple}','${jobs.own}','S2F multiple blockers','2099-01-11T00:00:00Z','2099-01-11T04:00:00Z',1,'recruiting'),
    ('${shifts.foreign}','${jobs.foreign}','S2F foreign','2099-01-12T00:00:00Z','2099-01-12T04:00:00Z',1,'recruiting'),
    ('${shifts.multipleConflict}','${jobs.own}','S2F multiple conflict','2099-01-11T02:00:00Z','2099-01-11T05:00:00Z',1,'confirmed');
    insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by) values
      ('${assignmentIds.conflict}','${shifts.conflictSource}','${workers.own}','manager','assigned','${actors.manager}');
    insert into public.worker_availability_intervals(worker_id,kind,starts_at,ends_at,created_by_profile_id) values
      ('${workers.own}','available','2099-01-06T00:00:00Z','2099-01-06T02:00:00Z','${actors.worker}'),
      ('${workers.own}','consultable','2099-01-07T00:00:00Z','2099-01-07T04:00:00Z','${actors.worker}'),
      ('${workers.own}','unavailable','2099-01-08T01:00:00Z','2099-01-08T02:00:00Z','${actors.worker}');`);

  const unknown = candidate(actors.manager, workers.own, shifts.unknown);
  pass("all hard facts true yields candidateEligible true", unknown.candidateEligible === true && unknown.workerStatusEligible && unknown.requirementsEligible && unknown.availabilityEligible && unknown.overlapEligible);
  pass("availability unknown stays eligible with warning", unknown.availabilityState === "unknown" && codes(unknown.warnings).includes("availability_unknown"));
  pass("result scope is explicitly limited", unknown.eligibilityScope === "implemented_hard_rules_only");

  const partial = candidate(actors.manager, workers.own, shifts.partial);
  pass("partial availability stays eligible with warning", partial.candidateEligible === true && codes(partial.warnings).includes("availability_partially_confirmed"));
  const consultable = candidate(actors.manager, workers.own, shifts.consultable);
  pass("consultable stays eligible with warning", consultable.candidateEligible === true && codes(consultable.warnings).includes("availability_consultation_required"));
  const unavailable = candidate(actors.manager, workers.own, shifts.unavailable);
  pass("unavailable overlap blocks candidate", unavailable.candidateEligible === false && codes(unavailable.blockingReasons).includes("availability_unavailable"));

  const expired = candidate(actors.manager, workers.own, shifts.expired);
  pass("expired Qualification blocks candidate", expired.candidateEligible === false && codes(expired.blockingReasons).includes("qualification_expired"));

  asActor(actors.admin, `public.set_worker_qualification_holding('${workers.own}','${qualificationId}','S2F-SECRET',null,'2098-01-01','2099-12-31','2099-01-01T00:00:00Z')`);
  const revoked = candidate(actors.manager, workers.own, shifts.unknown);
  pass("revoked Qualification blocks candidate", revoked.candidateEligible === false && codes(revoked.blockingReasons).includes("qualification_revoked"));
  asActor(actors.admin, `public.set_worker_qualification_holding('${workers.own}','${qualificationId}','S2F-SECRET',null,'2098-01-01','2099-12-31',null)`);

  asActor(actors.admin, `public.set_worker_skill_holding('${workers.own}','${skillId}',null,false)`);
  const missingSkill = candidate(actors.manager, workers.own, shifts.unknown);
  pass("missing required Skill blocks candidate", missingSkill.candidateEligible === false && codes(missingSkill.blockingReasons).includes("skill_missing"));
  asActor(actors.admin, `public.set_worker_skill_holding('${workers.own}','${skillId}',null,true)`);

  run(`update public.workers set status='inactive' where id='${workers.own}';`);
  const inactive = candidate(actors.manager, workers.own, shifts.unknown);
  pass("inactive Worker blocks candidate", inactive.candidateEligible === false && codes(inactive.blockingReasons).includes("worker_inactive"));
  run(`update public.workers set status='active' where id='${workers.own}';`);

  const conflict = candidate(actors.manager, workers.own, shifts.conflictTarget);
  pass("Assignment conflict blocks candidate and remains explainable", conflict.candidateEligible === false && codes(conflict.blockingReasons).includes("assignment_time_conflict") && conflict.conflictingAssignments.length === 1);

  asActor(actors.worker, `public.set_own_work_conditions(array[1]::smallint[],'00:00','01:00',false,null,null,null,true)`);
  const preferenceMismatch = candidate(actors.manager, workers.own, shifts.unknown);
  pass("preference mismatch is nonblocking", preferenceMismatch.candidateEligible === true && preferenceMismatch.preferenceMatches.preferredSchedule === "not_matched" && codes(preferenceMismatch.warnings).includes("preferred_time_not_matched"));

  run(`begin;
    update public.workers set status='suspended' where id='${workers.own}';
    update public.worker_skills set is_active=false where worker_id='${workers.own}' and skill_id='${skillId}';
    update public.worker_qualifications set revoked_at='2099-01-01T00:00:00Z' where worker_id='${workers.own}' and qualification_id='${qualificationId}';
    insert into public.worker_availability_intervals(worker_id,kind,starts_at,ends_at,created_by_profile_id)
      values('${workers.own}','unavailable','2099-01-11T00:30:00Z','2099-01-11T01:30:00Z','${actors.worker}');
    insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by)
      values('${assignmentIds.multiple}','${shifts.multipleConflict}','${workers.own}','manager','assigned','${actors.manager}');
  commit;`);
  const multiple = candidate(actors.manager, workers.own, shifts.multiple);
  pass("multiple blocking reasons remain visible", codes(multiple.blockingReasons).join(",") === "worker_suspended,skill_missing,qualification_revoked,availability_unavailable,assignment_time_conflict");
  pass("reason classification and ordering are deterministic", multiple.blockingReasons.every((item) => item.classification === "blocking") && JSON.stringify(codes(multiple.blockingReasons)) === JSON.stringify(codes(candidate(actors.manager, workers.own, shifts.multiple).blockingReasons)));

  const foreignShift = candidate(actors.manager, workers.own, shifts.foreign);
  const foreignWorker = candidate(actors.manager, workers.foreign, shifts.unknown);
  const missing = candidate(actors.manager, "ffffffff-ffff-ffff-ffff-ffffffffffff", shifts.unknown);
  pass("foreign or missing sources converge to safe unavailable", [foreignShift, foreignWorker, missing].every((result) => result.sourceAvailable === false && result.candidateEligible === false && result.blockingReasons.length === 0));
  const adminCrossBranch = candidate(actors.admin, workers.own, shifts.foreign);
  pass("System Admin can evaluate cross-Branch context", adminCrossBranch.sourceAvailable === true);
  const workerAttempt = candidate(actors.worker, workers.own, shifts.unknown);
  pass("Worker cannot use Admin candidate reader", workerAttempt.sourceAvailable === false);
  const anonAttempt = run(`begin; set local role anon; select public.get_worker_shift_candidate_eligibility('${workers.own}','${shifts.unknown}'); commit;`, { allowFailure: true });
  pass("anon cannot execute candidate reader", anonAttempt.includes("permission denied"));
  pass("candidate response exposes no credential or auth identity", !JSON.stringify(unknown).includes("S2F-SECRET") && !JSON.stringify(unknown).includes("auth_profile") && !JSON.stringify(unknown).includes("credential"));

  cleanup();
  pass("STAFF-2F fixtures are fully cleaned", scalar(`select (select count(*) from public.skills where code like 'S2F-%') + (select count(*) from public.qualifications where code like 'S2F-%') + (select count(*) from public.shift_slots where id::text like 'f2000000-0000-0000-0000-%') + (select count(*) from public.assignments where id in ('${assignmentIds.conflict}','${assignmentIds.multiple}'));`) === "0");
  console.log(`Candidate Eligibility: ${passed}/${passed} passed`);
} finally {
  cleanup();
}
