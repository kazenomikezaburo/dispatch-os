import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const args = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const manager = "a0000000-0000-0000-0000-000000000004";
const admin = "a0000000-0000-0000-0000-000000000005";
const workerActor = "a0000000-0000-0000-0000-000000000001";
const ownBranch = "b0000000-0000-0000-0000-000000000001";
const foreignBranch = "b0000000-0000-0000-0000-000000000002";
const job = "10000000-0000-0000-0000-000000000001";
const target = "f5000000-0000-0000-0000-000000000001";
const overlap = "f5000000-0000-0000-0000-000000000002";
const workers = {
  eligible: "f5100000-0000-0000-0000-000000000001",
  existing: "f5100000-0000-0000-0000-000000000002",
  blocked: "f5100000-0000-0000-0000-000000000003",
  inactive: "f5100000-0000-0000-0000-000000000004",
  foreign: "f5100000-0000-0000-0000-000000000005",
};

function run(sql, allowFailure = false) {
  try { return execFileSync("docker", args, { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (error) { if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`; throw error; }
}
function actorSql(actor, body, role = "authenticated") { return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${actor}","role":"${role}"}'; ${body} commit;`; }
function scalar(sql) { return run(sql).split(/\r?\n/).at(-1); }
function list(actor, limit = 100) { return JSON.parse(scalar(actorSql(actor, `select public.list_shift_candidate_eligibility('${target}',${limit})::text;`))); }
function cleanup() {
  run(`begin;
    delete from public.assignments where shift_slot_id in ('${target}','${overlap}');
    delete from public.worker_availability_intervals where worker_id in ('${workers.eligible}','${workers.existing}','${workers.blocked}','${workers.inactive}','${workers.foreign}');
    delete from public.shift_slots where id in ('${target}','${overlap}');
    delete from public.workers where id in ('${workers.eligible}','${workers.existing}','${workers.blocked}','${workers.inactive}','${workers.foreign}');
  commit;`);
}
let passed = 0;
function pass(name, value) { assert.ok(value, name); passed += 1; console.log(`PASS ${name}`); }

try {
  cleanup();
  run(`begin;
    insert into public.workers(id,staff_code,branch_id,display_name,status) values
      ('${workers.eligible}','S2G3-001','${ownBranch}','青山 候補','active'),
      ('${workers.existing}','S2G3-002','${ownBranch}','田中 配置済','active'),
      ('${workers.blocked}','S2G3-003','${ownBranch}','山田 重複','active'),
      ('${workers.inactive}','S2G3-004','${ownBranch}','佐藤 休止','inactive'),
      ('${workers.foreign}','S2G3-005','${foreignBranch}','鈴木 他支店','active');
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,required_workers,status) values
      ('${target}','${job}','S2G3 target','2102-02-01T00:00:00Z','2102-02-01T04:00:00Z',4,'recruiting'),
      ('${overlap}','${job}','S2G3 overlap','2102-02-01T02:00:00Z','2102-02-01T05:00:00Z',2,'confirmed');
    insert into public.assignments(shift_slot_id,worker_id,source,status,assigned_by) values
      ('${target}','${workers.existing}','manager','assigned','${manager}'),
      ('${overlap}','${workers.blocked}','manager','confirmed','${manager}');
  commit;`);

  pass("read composer is hardened", scalar(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='list_shift_candidate_eligibility' and p.prosecdef and p.provolatile='s' and p.proconfig @> array['search_path=""'];`) === "1");
  pass("only authenticated can execute", scalar(`select has_function_privilege('authenticated','public.list_shift_candidate_eligibility(uuid,integer)','execute')::text||'|'||has_function_privilege('anon','public.list_shift_candidate_eligibility(uuid,integer)','execute')::text||'|'||has_function_privilege('service_role','public.list_shift_candidate_eligibility(uuid,integer)','execute')::text;`) === "true|false|false");

  const before = scalar(`select count(*) from public.assignments where shift_slot_id in ('${target}','${overlap}');`);
  const managerList = list(manager);
  const byId = new Map(managerList.items.map((item) => [item.workerId, item]));
  pass("Manager receives only authorized candidates", managerList.sourceAvailable && byId.has(workers.eligible) && !byId.has(workers.foreign));
  pass("eligible Worker remains selectable fact", byId.get(workers.eligible).facts.candidateEligible === true && byId.get(workers.eligible).facts.warnings.some((item) => item.code === "availability_unknown"));
  pass("target Assignment is separate from conflict", byId.get(workers.existing).facts.targetShiftAssignment.state === "active_existing" && byId.get(workers.existing).facts.overlapEligible === true);
  pass("other Shift overlap remains blocking", byId.get(workers.blocked).facts.candidateEligible === false && byId.get(workers.blocked).facts.blockingReasons.some((item) => item.code === "assignment_time_conflict"));
  pass("inactive Worker remains explainably ineligible", byId.get(workers.inactive).facts.blockingReasons.some((item) => item.code === "worker_inactive"));
  pass("reason and candidate order is deterministic", JSON.stringify(managerList.items) === JSON.stringify(list(manager).items));
  pass("read composer creates no Assignment", before === scalar(`select count(*) from public.assignments where shift_slot_id in ('${target}','${overlap}');`));

  const bounded = list(manager, 1);
  pass("bounded list clamps and reports truncation", bounded.limit === 1 && bounded.items.length === 1 && bounded.truncated === true);
  const adminList = list(admin);
  pass("System Admin organization scope includes foreign Branch Worker", adminList.items.some((item) => item.workerId === workers.foreign));
  const workerResult = list(workerActor);
  pass("Worker caller receives safe unavailable", workerResult.sourceAvailable === false && workerResult.items.length === 0);
  const foreignShift = JSON.parse(scalar(actorSql(manager, `select public.list_shift_candidate_eligibility('20000000-0000-0000-0000-000000000003',100)::text;`)));
  pass("foreign Shift receives safe unavailable", foreignShift.sourceAvailable === false && foreignShift.items.length === 0);
  pass("anon execution is denied", run(actorSql("00000000-0000-0000-0000-000000000000", `select public.list_shift_candidate_eligibility('${target}',100);`, "anon"), true).includes("permission denied"));

  cleanup();
  pass("STAFF-2G.3 read fixtures are fully cleaned", scalar(`select (select count(*) from public.shift_slots where id in ('${target}','${overlap}')) + (select count(*) from public.workers where id::text like 'f5100000-0000-0000-0000-%');`) === "0");
  console.log(`Candidate Picker Read Model: ${passed}/${passed} passed`);
} finally {
  cleanup();
}
