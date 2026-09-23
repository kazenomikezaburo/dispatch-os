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
const shifts = {
  early: "52c00000-0000-0000-0000-000000000001",
  late: "52c00000-0000-0000-0000-000000000002",
  jstBoundary: "52c00000-0000-0000-0000-000000000003",
  foreign: "52c00000-0000-0000-0000-000000000004",
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

function fact(result, code) {
  return result.requirements.find((item) => item.code === code);
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
    delete from public.job_skill_requirements where skill_id in (
      select id from public.skills where code like 'S2C-%'
    );
    delete from public.job_qualification_requirements where qualification_id in (
      select id from public.qualifications where code like 'S2C-%'
    );
    delete from public.worker_skills where skill_id in (
      select id from public.skills where code like 'S2C-%'
    );
    delete from public.worker_qualifications where qualification_id in (
      select id from public.qualifications where code like 'S2C-%'
    );
    delete from public.shift_slots where id in ('${shifts.early}','${shifts.late}','${shifts.jstBoundary}','${shifts.foreign}');
    delete from public.qualifications where code like 'S2C-%';
    delete from public.skills where code like 'S2C-%';
  commit;`);
}

try {
  cleanup();
  const freeTextBefore = scalar(`select coalesce(requirements, '<NULL>') from public.jobs where id='${jobs.own}';`);

  pass("both requirement tables have RLS enabled", scalar(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('job_skill_requirements','job_qualification_requirements') and c.relrowsecurity;`) === "2");
  pass("runtime roles have no direct requirement writes", scalar(`select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('job_skill_requirements','job_qualification_requirements') and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');`) === "0");
  pass("all public requirement commands and reader are hardened", scalar(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('add_job_skill_requirement','remove_job_skill_requirement','add_job_qualification_requirement','remove_job_qualification_requirement','get_worker_shift_requirement_facts') and p.prosecdef and p.proconfig @> array['search_path=""'];`) === "5");

  const skillSatisfied = asActor(actors.admin, `public.create_skill_master('S2C-SKILL-SAT','Satisfied skill',null)`);
  const skillMissing = asActor(actors.admin, `public.create_skill_master('S2C-SKILL-MISSING','Missing skill',null)`);
  const skillInactive = asActor(actors.admin, `public.create_skill_master('S2C-SKILL-INACTIVE','Inactive required skill',null)`);
  const skillRemove = asActor(actors.admin, `public.create_skill_master('S2C-SKILL-REMOVE','Removable skill',null)`);

  const qNone = asActor(actors.admin, `public.create_qualification_master('S2C-Q-NONE','No expiry',null,'none')`);
  const qFuture = asActor(actors.admin, `public.create_qualification_master('S2C-Q-FUTURE','Future validity',null,'required')`);
  const qExpiry = asActor(actors.admin, `public.create_qualification_master('S2C-Q-EXPIRY','Expiring',null,'required')`);
  const qRevoked = asActor(actors.admin, `public.create_qualification_master('S2C-Q-REVOKED','Revoked',null,'optional')`);
  const qMissing = asActor(actors.admin, `public.create_qualification_master('S2C-Q-MISSING','Missing qualification',null,'optional')`);
  const qInactive = asActor(actors.admin, `public.create_qualification_master('S2C-Q-INACTIVE','Inactive required qualification',null,'optional')`);
  const qRemove = asActor(actors.admin, `public.create_qualification_master('S2C-Q-REMOVE','Removable qualification',null,'optional')`);

  asActor(actors.manager, `public.add_job_skill_requirement('${jobs.own}','${skillSatisfied}')`);
  pass("Manager adds own-Branch Skill requirement", scalar(`select count(*) from public.job_skill_requirements where job_id='${jobs.own}' and skill_id='${skillSatisfied}';`) === "1");
  asActor(actors.manager, `public.add_job_skill_requirement('${jobs.own}','${skillRemove}')`);
  const removedSkill = JSON.parse(asActor(actors.manager, `public.remove_job_skill_requirement('${jobs.own}','${skillRemove}')`));
  pass("Manager removes own-Branch Skill requirement", removedSkill.removed === true);

  asActor(actors.admin, `public.add_job_qualification_requirement('${jobs.own}','${qRemove}')`);
  const removedQualification = JSON.parse(asActor(actors.admin, `public.remove_job_qualification_requirement('${jobs.own}','${qRemove}')`));
  pass("System Admin removes Qualification requirement", removedQualification.removed === true);

  for (const id of [skillMissing, skillInactive]) asActor(actors.admin, `public.add_job_skill_requirement('${jobs.own}','${id}')`);
  for (const id of [qNone, qFuture, qExpiry, qRevoked, qMissing, qInactive]) asActor(actors.admin, `public.add_job_qualification_requirement('${jobs.own}','${id}')`);

  const duplicateSkill = run(roleSql(actors.manager, `select public.add_job_skill_requirement('${jobs.own}','${skillSatisfied}');`), { allowFailure: true });
  pass("duplicate Skill requirement is rejected by primary key", duplicateSkill.includes("job_skill_requirements_pkey"));
  const duplicateQualification = run(roleSql(actors.admin, `select public.add_job_qualification_requirement('${jobs.own}','${qNone}');`), { allowFailure: true });
  pass("duplicate Qualification requirement is rejected by primary key", duplicateQualification.includes("job_qualification_requirements_pkey"));

  asActor(actors.admin, `public.update_skill_master('${skillInactive}','Inactive required skill',null,false)`);
  asActor(actors.admin, `public.update_qualification_master('${qInactive}','Inactive required qualification',null,'optional',false)`);
  pass("existing requirements survive later master deactivation", scalar(`select (select count(*) from public.job_skill_requirements where skill_id='${skillInactive}') + (select count(*) from public.job_qualification_requirements where qualification_id='${qInactive}');`) === "2");

  const inactiveNewSkill = asActor(actors.admin, `public.create_skill_master('S2C-SKILL-INACTIVE-NEW','Inactive new skill',null)`);
  asActor(actors.admin, `public.update_skill_master('${inactiveNewSkill}','Inactive new skill',null,false)`);
  const inactiveSkillAttach = run(roleSql(actors.admin, `select public.add_job_skill_requirement('${jobs.own}','${inactiveNewSkill}');`), { allowFailure: true });
  pass("inactive Skill cannot be newly required", inactiveSkillAttach.includes("inactive_or_missing_skill"));

  const inactiveNewQ = asActor(actors.admin, `public.create_qualification_master('S2C-Q-INACTIVE-NEW','Inactive new qualification',null,'optional')`);
  asActor(actors.admin, `public.update_qualification_master('${inactiveNewQ}','Inactive new qualification',null,'optional',false)`);
  const inactiveQAttach = run(roleSql(actors.admin, `select public.add_job_qualification_requirement('${jobs.own}','${inactiveNewQ}');`), { allowFailure: true });
  pass("inactive Qualification cannot be newly required", inactiveQAttach.includes("inactive_or_missing_qualification"));

  const foreignAttempt = run(roleSql(actors.manager, `select public.add_job_skill_requirement('${jobs.foreign}','${skillSatisfied}');`), { allowFailure: true });
  pass("Manager cannot mutate foreign-Branch Job requirements", foreignAttempt.includes("job_requirement_unavailable"));

  asActor(actors.admin, `public.set_worker_skill_holding('${workers.own}','${skillSatisfied}',null,true)`);
  asActor(actors.admin, `public.set_worker_qualification_holding('${workers.own}','${qNone}','SECRET-NONE',null,null,null,null)`);
  asActor(actors.admin, `public.set_worker_qualification_holding('${workers.own}','${qFuture}','SECRET-FUTURE',null,'2030-01-01','2032-12-31',null)`);
  asActor(actors.admin, `public.set_worker_qualification_holding('${workers.own}','${qExpiry}','SECRET-EXPIRY',null,'2020-01-01','2030-01-01',null)`);
  asActor(actors.admin, `public.set_worker_qualification_holding('${workers.own}','${qRevoked}','SECRET-REVOKED',null,null,null,'2026-01-01T00:00:00Z')`);

  run(`insert into public.shift_slots(id,job_id,label,starts_at,ends_at) values
    ('${shifts.early}','${jobs.own}','S2C early','2029-06-01T00:00:00Z','2029-06-01T08:00:00Z'),
    ('${shifts.late}','${jobs.own}','S2C late','2031-06-01T00:00:00Z','2031-06-01T08:00:00Z'),
    ('${shifts.jstBoundary}','${jobs.own}','S2C JST boundary','2030-01-01T15:30:00Z','2030-01-01T23:30:00Z'),
    ('${shifts.foreign}','${jobs.foreign}','S2C foreign','2031-06-01T00:00:00Z','2031-06-01T08:00:00Z');`);

  const early = JSON.parse(asActor(actors.manager, `public.get_worker_shift_requirement_facts('${workers.own}','${shifts.early}')`));
  pass("authorized fact reader derives Shift Job and source context", early.sourceAvailable && early.jobId === jobs.own && early.evaluationDate === "2029-06-01");
  pass("Skill facts explain satisfied and missing", fact(early, "S2C-SKILL-SAT").state === "satisfied" && fact(early, "S2C-SKILL-MISSING").state === "missing");
  pass("inactive Skill master is a closed requirement fact", fact(early, "S2C-SKILL-INACTIVE").state === "requirement_master_inactive");
  pass("Qualification without expiry is satisfied", fact(early, "S2C-Q-NONE").state === "satisfied");
  pass("future Qualification is not yet valid at early Shift", fact(early, "S2C-Q-FUTURE").state === "not_yet_valid");
  pass("Qualification valid at target Shift date is satisfied", fact(early, "S2C-Q-EXPIRY").state === "satisfied");
  pass("revoked Qualification is explained", fact(early, "S2C-Q-REVOKED").state === "revoked");
  pass("missing Qualification is explained", fact(early, "S2C-Q-MISSING").state === "missing");
  pass("inactive Qualification master is a closed requirement fact", fact(early, "S2C-Q-INACTIVE").state === "requirement_master_inactive");
  pass("requirementsEligible covers Skill and Qualification facts only", early.requirementsEligible === false && early.reasonCodes.includes("skill_missing") && early.reasonCodes.includes("qualification_missing"));

  const late = JSON.parse(asActor(actors.manager, `public.get_worker_shift_requirement_facts('${workers.own}','${shifts.late}')`));
  pass("future Qualification becomes satisfied at later Shift", fact(late, "S2C-Q-FUTURE").state === "satisfied");
  pass("expiry is evaluated at Shift date rather than current time", fact(late, "S2C-Q-EXPIRY").state === "expired" && late.reasonCodes.includes("qualification_expired"));

  const boundary = JSON.parse(asActor(actors.manager, `public.get_worker_shift_requirement_facts('${workers.own}','${shifts.jstBoundary}')`));
  pass("Shift start is converted to Asia/Tokyo calendar date", boundary.evaluationDate === "2030-01-02" && fact(boundary, "S2C-Q-EXPIRY").state === "expired");
  pass("credential numbers are never exposed by fact reader", !JSON.stringify(boundary).includes("SECRET-") && !JSON.stringify(boundary).includes("credential"));

  const foreignShift = JSON.parse(asActor(actors.manager, `public.get_worker_shift_requirement_facts('${workers.own}','${shifts.foreign}')`));
  const foreignWorker = JSON.parse(asActor(actors.manager, `public.get_worker_shift_requirement_facts('${workers.foreign}','${shifts.early}')`));
  pass("foreign Shift and Worker contexts converge to safe unavailable", foreignShift.sourceAvailable === false && foreignWorker.sourceAvailable === false && foreignShift.requirements.length === 0);
  const adminCrossBranch = JSON.parse(asActor(actors.admin, `public.get_worker_shift_requirement_facts('${workers.own}','${shifts.foreign}')`));
  pass("System Admin can evaluate across Branches", adminCrossBranch.sourceAvailable === true && adminCrossBranch.jobId === jobs.foreign);
  const workerRead = JSON.parse(asActor(actors.worker, `public.get_worker_shift_requirement_facts('${workers.own}','${shifts.early}')`));
  pass("Worker receives safe unavailable from Admin fact reader", workerRead.sourceAvailable === false);
  const anonCall = run(`begin; set local role anon; select public.get_worker_shift_requirement_facts('${workers.own}','${shifts.early}'); commit;`, { allowFailure: true });
  pass("anon cannot execute requirement reader", anonCall.includes("permission denied"));

  const managerOwnRows = asActor(actors.manager, `(select count(*) from public.job_skill_requirements where job_id='${jobs.own}')`);
  const managerForeignRows = asActor(actors.manager, `(select count(*) from public.job_skill_requirements where job_id='${jobs.foreign}')`);
  pass("requirement table RLS keeps Manager in own Branch", Number(managerOwnRows) > 0 && managerForeignRows === "0");
  pass("jobs.requirements free text remains unchanged", scalar(`select coalesce(requirements, '<NULL>') from public.jobs where id='${jobs.own}';`) === freeTextBefore);

  cleanup();
  pass("STAFF-2C fixtures are fully cleaned", scalar(`select (select count(*) from public.skills where code like 'S2C-%') + (select count(*) from public.qualifications where code like 'S2C-%') + (select count(*) from public.shift_slots where id in ('${shifts.early}','${shifts.late}','${shifts.jstBoundary}','${shifts.foreign}'));`) === "0");
  console.log(`Structured Job Requirements: ${passed}/${passed} passed`);
} finally {
  cleanup();
}
