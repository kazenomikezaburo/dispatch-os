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
  ownSecond: "c0000000-0000-0000-0000-000000000002",
  foreign: "c0000000-0000-0000-0000-000000000003",
};
const codes = {
  skill: "S2B-SKILL",
  foreignSkill: "S2B-FOREIGN",
  none: "S2B-Q-NONE",
  optional: "S2B-Q-OPTIONAL",
  required: "S2B-Q-REQUIRED",
  inactive: "S2B-Q-INACTIVE",
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

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
    delete from public.worker_qualifications where qualification_id in (
      select id from public.qualifications where code like 'S2B-%'
    );
    delete from public.worker_skills where skill_id in (
      select id from public.skills where code like 'S2B-%'
    );
    delete from public.qualifications where code like 'S2B-%';
    delete from public.skills where code like 'S2B-%';
  commit;`);
}

try {
  cleanup();

  const rls = scalar(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('skills','qualifications','worker_skills','worker_qualifications') and c.relrowsecurity;`);
  pass("all four canonical tables have RLS enabled", rls === "4");

  const runtimeWrites = scalar(`select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('skills','qualifications','worker_skills','worker_qualifications') and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');`);
  pass("runtime roles have no direct holding or master writes", runtimeWrites === "0");

  const hardened = scalar(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_skill_master','update_skill_master','create_qualification_master','update_qualification_master','set_worker_skill_holding','set_worker_qualification_holding') and p.prosecdef and p.proconfig @> array['search_path=""'];`);
  pass("all six mutation commands are hardened security-definer functions", hardened === "6");

  const skillId = scalar(roleSql(actors.admin, `select public.create_skill_master('  s2b-skill  ','  Event desk  ','   ')::text;`));
  const skillRow = scalar(`select code||'|'||name||'|'||coalesce(description,'NULL') from public.skills where id='${skillId}';`);
  pass("System Admin creates Skill with canonical code and trimmed metadata", skillRow === "S2B-SKILL|Event desk|NULL");

  const duplicateSkill = run(roleSql(actors.admin, `select public.create_skill_master('s2b-skill','Duplicate',null);`), { allowFailure: true });
  pass("normalized duplicate Skill code is rejected", duplicateSkill.includes("duplicate key value"));

  const blankSkill = run(roleSql(actors.admin, `select public.create_skill_master('   ','Name',null);`), { allowFailure: true });
  pass("blank Skill code is rejected", blankSkill.includes("skills_code_not_blank") || blankSkill.includes("skills_code_canonical"));

  scalar(roleSql(actors.admin, `select public.update_skill_master('${skillId}','  Updated skill  ',' detail ',true)::text;`));
  pass("Skill metadata updates without changing stable code", scalar(`select code||'|'||name||'|'||description from public.skills where id='${skillId}';`) === "S2B-SKILL|Updated skill|detail");

  const changedSkillCode = run(`update public.skills set code='S2B-CHANGED' where id='${skillId}';`, { allowFailure: true });
  pass("Skill code is immutable after creation", changedSkillCode.includes("master_code_immutable"));

  const noneId = scalar(roleSql(actors.admin, `select public.create_qualification_master('${codes.none}','No expiry qualification',null,'none')::text;`));
  const optionalId = scalar(roleSql(actors.admin, `select public.create_qualification_master('  s2b-q-optional  ','Optional expiry qualification',null,'optional')::text;`));
  const requiredId = scalar(roleSql(actors.admin, `select public.create_qualification_master('${codes.required}','Required expiry qualification',null,'required')::text;`));
  const inactiveId = scalar(roleSql(actors.admin, `select public.create_qualification_master('${codes.inactive}','Inactive qualification',null,'optional')::text;`));
  pass("System Admin creates all frozen Qualification expiry policies", scalar(`select string_agg(expiry_policy,',' order by expiry_policy) from public.qualifications where code like 'S2B-Q-%';`) === "none,optional,optional,required");
  pass("Qualification code uses the same canonical normalization", scalar(`select code from public.qualifications where id='${optionalId}';`) === codes.optional);

  const duplicateQualification = run(roleSql(actors.admin, `select public.create_qualification_master(' s2b-q-none ','Duplicate',null,'none');`), { allowFailure: true });
  pass("normalized duplicate Qualification code is rejected", duplicateQualification.includes("duplicate key value"));

  scalar(roleSql(actors.admin, `select public.update_qualification_master('${optionalId}','Updated optional','trimmed','optional',true)::text;`));
  pass("Qualification metadata and lifecycle command updates canonical row", scalar(`select name||'|'||description from public.qualifications where id='${optionalId}';`) === "Updated optional|trimmed");

  scalar(roleSql(actors.admin, `select public.set_worker_skill_holding('${workers.own}','${skillId}','2026-01-01',true)::text;`));
  pass("System Admin creates active Worker Skill holding", scalar(`select acquired_on||'|'||is_active from public.worker_skills where worker_id='${workers.own}' and skill_id='${skillId}';`) === "2026-01-01|true");

  const duplicateWorkerSkill = run(`insert into public.worker_skills(worker_id,skill_id) values('${workers.own}','${skillId}');`, { allowFailure: true });
  pass("duplicate Worker Skill is rejected by primary key", duplicateWorkerSkill.includes("worker_skills_pkey"));

  scalar(roleSql(actors.admin, `select public.update_skill_master('${skillId}','Updated skill','detail',false)::text;`));
  pass("Skill deactivation preserves existing holding", scalar(`select (not s.is_active)::text||'|'||ws.is_active::text from public.skills s join public.worker_skills ws on ws.skill_id=s.id where s.id='${skillId}' and ws.worker_id='${workers.own}';`) === "true|true");

  const inactiveSkillHolding = run(roleSql(actors.admin, `select public.set_worker_skill_holding('${workers.ownSecond}','${skillId}',null,true);`), { allowFailure: true });
  pass("inactive Skill cannot receive a new holding", inactiveSkillHolding.includes("inactive_skill"));

  scalar(roleSql(actors.admin, `select public.set_worker_skill_holding('${workers.own}','${skillId}','2026-01-01',false)::text;`));
  pass("existing Worker Skill can be made inactive", scalar(`select is_active from public.worker_skills where worker_id='${workers.own}' and skill_id='${skillId}';`) === "f");

  scalar(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.own}','${noneId}',' CERT-1 ','2025-01-01','2025-01-01',null,null)::text;`));
  pass("Qualification with no expiry is stored for none policy", scalar(`select credential_number||'|'||coalesce(expires_on::text,'NULL') from public.worker_qualifications where worker_id='${workers.own}' and qualification_id='${noneId}';`) === "CERT-1|NULL");

  scalar(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.own}','${requiredId}','CERT-2','2025-01-01','2025-01-01','2027-12-31',null)::text;`));
  pass("Qualification with required expiry is stored", scalar(`select expires_on from public.worker_qualifications where worker_id='${workers.own}' and qualification_id='${requiredId}';`) === "2027-12-31");

  const missingRequiredExpiry = run(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.ownSecond}','${requiredId}',null,null,null,null,null);`), { allowFailure: true });
  pass("required expiry policy rejects missing expiry", missingRequiredExpiry.includes("qualification_expiry_required"));

  const forbiddenExpiry = run(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.ownSecond}','${noneId}',null,null,null,'2027-12-31',null);`), { allowFailure: true });
  pass("none expiry policy rejects supplied expiry", forbiddenExpiry.includes("qualification_expiry_forbidden"));

  const invalidDates = run(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.ownSecond}','${optionalId}',null,null,'2027-01-02','2027-01-01',null);`), { allowFailure: true });
  pass("valid_from after expires_on is rejected", invalidDates.includes("worker_qualifications_valid_dates"));

  scalar(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.own}','${optionalId}','CERT-3','2025-01-01','2025-01-01',null,'2026-09-21T00:00:00Z')::text;`));
  pass("revoked Qualification persists as an explicit fact", scalar(`select (revoked_at is not null)::text from public.worker_qualifications where worker_id='${workers.own}' and qualification_id='${optionalId}';`) === "true");

  const duplicateWorkerQualification = run(`insert into public.worker_qualifications(worker_id,qualification_id) values('${workers.own}','${noneId}');`, { allowFailure: true });
  pass("duplicate Worker Qualification is rejected by primary key", duplicateWorkerQualification.includes("worker_qualifications_pkey"));

  scalar(roleSql(actors.admin, `select public.update_qualification_master('${inactiveId}','Inactive qualification',null,'optional',false)::text;`));
  const inactiveQualificationHolding = run(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.own}','${inactiveId}',null,null,null,null,null);`), { allowFailure: true });
  pass("inactive Qualification cannot receive a new holding", inactiveQualificationHolding.includes("inactive_qualification"));

  scalar(roleSql(actors.admin, `select public.update_qualification_master('${requiredId}','Required expiry qualification',null,'required',false)::text;`));
  pass("Qualification deactivation preserves existing holding", scalar(`select (not q.is_active)::text||'|'||wq.expires_on::text from public.qualifications q join public.worker_qualifications wq on wq.qualification_id=q.id where q.id='${requiredId}' and wq.worker_id='${workers.own}';`) === "true|2027-12-31");

  const conflictingPolicy = run(roleSql(actors.admin, `select public.update_qualification_master('${noneId}','No expiry qualification',null,'required',true);`), { allowFailure: true });
  pass("master policy change cannot invalidate existing credentials", conflictingPolicy.includes("qualification_policy_conflicts_with_holdings"));

  const foreignSkillId = scalar(roleSql(actors.admin, `select public.create_skill_master('${codes.foreignSkill}','Foreign Branch skill',null)::text;`));
  scalar(roleSql(actors.admin, `select public.set_worker_skill_holding('${workers.foreign}','${foreignSkillId}',null,true)::text;`));
  scalar(roleSql(actors.admin, `select public.set_worker_qualification_holding('${workers.foreign}','${optionalId}','FOREIGN-CERT',null,null,null,null)::text;`));
  const managerRows = scalar(roleSql(actors.manager, `select count(*) from public.worker_skills where skill_id in ('${skillId}','${foreignSkillId}');`));
  pass("Manager reads own-Branch holding and not foreign Branch holding", managerRows === "1");

  const managerQualificationRows = scalar(roleSql(actors.manager, `select count(*) from public.worker_qualifications where qualification_id='${optionalId}';`));
  pass("Manager Qualification read is isolated to own Branch", managerQualificationRows === "1");

  const adminRows = scalar(roleSql(actors.admin, `select count(*) from public.worker_skills where skill_id in ('${skillId}','${foreignSkillId}');`));
  pass("System Admin reads holdings across Branches", adminRows === "2");

  const adminQualificationRows = scalar(roleSql(actors.admin, `select count(*) from public.worker_qualifications where qualification_id='${optionalId}';`));
  pass("System Admin reads Qualification holdings across Branches", adminQualificationRows === "2");

  const workerRows = scalar(roleSql(actors.worker, `select count(*) from public.worker_skills where skill_id in ('${skillId}','${foreignSkillId}');`));
  pass("Worker receives no new holding read access", workerRows === "0");

  const workerMasterRows = scalar(roleSql(actors.worker, `select count(*) from public.skills where code like 'S2B-%';`));
  pass("Worker receives no new master read access", workerMasterRows === "0");

  const anonRead = run(`begin; set local role anon; select count(*) from public.skills; commit;`, { allowFailure: true });
  pass("anon cannot read Skill master", anonRead.includes("permission denied"));

  const managerMutation = run(roleSql(actors.manager, `select public.create_skill_master('S2B-MANAGER','Forbidden',null);`), { allowFailure: true });
  pass("Manager cannot mutate master through command", managerMutation.includes("staff_master_forbidden"));

  const workerMutation = run(roleSql(actors.worker, `select public.set_worker_skill_holding('${workers.own}','${skillId}',null,true);`), { allowFailure: true });
  pass("Worker cannot mutate holding through command", workerMutation.includes("staff_holding_forbidden"));

  const directManagerWrite = run(roleSql(actors.manager, `insert into public.skills(code,name) values('S2B-DIRECT','Forbidden');`), { allowFailure: true });
  pass("authenticated users have no direct master write privilege", directManagerWrite.includes("permission denied"));

  cleanup();
  const remaining = scalar(`select (select count(*) from public.skills where code like 'S2B-%') + (select count(*) from public.qualifications where code like 'S2B-%');`);
  pass("STAFF-2B fixtures are fully cleaned up", remaining === "0");

  console.log(`Staff Skill / Qualification Persistence: ${passed}/${passed} passed`);
} finally {
  cleanup();
}
