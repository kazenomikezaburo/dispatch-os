import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const actor = { workerA: "a0000000-0000-0000-0000-000000000001", workerB: "a0000000-0000-0000-0000-000000000002", foreign: "a0000000-0000-0000-0000-000000000003", manager: "a0000000-0000-0000-0000-000000000004" };
const worker = { a: "c0000000-0000-0000-0000-000000000001", b: "c0000000-0000-0000-0000-000000000002" };
const branch = { own: "b0000000-0000-0000-0000-000000000001", foreign: "b0000000-0000-0000-0000-000000000002" };
const id = (kind, n) => `b27${kind}0000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const workplace = { own: id("0", 1), foreign: id("0", 2) };
const project = { own: id("1", 1), foreign: id("1", 2) };
const job = { base: id("2", 1), skill: id("2", 2), foreign: id("2", 3) };
const shift = Object.fromEntries(["applyWithdraw", "missingSkill", "deadline", "full", "assigned", "foreign", "accepted", "rejected", "withdrawn", "concurrent", "adminAssignment"].map((name, index) => [name, id("3", index + 1)]));
const assignment = { full: id("4", 1), own: id("4", 2) };
const application = { accepted: id("5", 1), rejected: id("5", 2), withdrawn: id("5", 3) };
const skill = id("7", 1);
const key = (n) => `b2790000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let passed = 0;

function sql(statement, allowFailure = false) {
  try { return execFileSync("docker", psql, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (error) { if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`; throw error; }
}

function roleSql(profileId, statement, role = "authenticated") {
  return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; ${statement}; rollback;`;
}

function result(profileId, expression, role = "authenticated") {
  const statement = `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; select (${expression})::text; commit;`;
  return JSON.parse(sql(statement).split(/\r?\n/).at(-1));
}

function pass(name, condition) { assert.ok(condition, name); passed += 1; console.log(`PASS ${name}`); }

function concurrentResult(profileId, expression) {
  const statement = `begin; set local role authenticated; set local request.jwt.claims='{"sub":"${profileId}","role":"authenticated"}'; select (${expression})::text; commit;`;
  return new Promise((resolve, reject) => {
    const child = spawn("docker", psql, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1))) : reject(new Error(stderr)));
    child.stdin.end(statement);
  });
}

function cleanup() {
  sql(`begin;
    set local session_replication_role = replica;
    delete from private.worker_application_command_receipts where shift_id::text like 'b2730000-0000-0000-0000-%';
    delete from private.candidate_assignment_command_receipts where shift_id::text like 'b2730000-0000-0000-0000-%';
    delete from public.shift_applications where shift_slot_id::text like 'b2730000-0000-0000-0000-%';
    delete from public.assignments where shift_slot_id::text like 'b2730000-0000-0000-0000-%';
    delete from public.job_skill_requirements where job_id::text like 'b2720000-0000-0000-0000-%';
    delete from public.shift_slots where id::text like 'b2730000-0000-0000-0000-%';
    delete from public.jobs where id::text like 'b2720000-0000-0000-0000-%';
    delete from public.project_history_events where project_id::text like 'b2710000-0000-0000-0000-%';
    delete from public.projects where id::text like 'b2710000-0000-0000-0000-%';
    delete from public.workplaces where id::text like 'b2700000-0000-0000-0000-%';
    delete from public.skills where id::text like 'b2770000-0000-0000-0000-%';
  commit;`);
}

function setup() {
  cleanup();
  const rows = [
    [shift.applyWithdraw, job.base, "OCV1-03 Apply Withdraw", "2098-07-01T09:00:00+09", 2, null],
    [shift.missingSkill, job.skill, "OCV1-03 Missing Skill", "2098-07-02T09:00:00+09", 2, null],
    [shift.deadline, job.base, "OCV1-03 Deadline", "2098-07-03T09:00:00+09", 2, "2026-01-01T00:00:00Z"],
    [shift.full, job.base, "OCV1-03 Full", "2098-07-04T09:00:00+09", 1, null],
    [shift.assigned, job.base, "OCV1-03 Assigned", "2098-07-05T09:00:00+09", 1, null],
    [shift.foreign, job.foreign, "OCV1-03 Foreign", "2098-07-06T09:00:00+09", 2, null],
    [shift.accepted, job.base, "OCV1-03 Accepted", "2098-07-07T09:00:00+09", 2, null],
    [shift.rejected, job.base, "OCV1-03 Rejected", "2098-07-08T09:00:00+09", 2, null],
    [shift.withdrawn, job.base, "OCV1-03 Withdrawn", "2098-07-09T09:00:00+09", 2, null],
    [shift.concurrent, job.base, "OCV1-03 Concurrent", "2098-07-10T09:00:00+09", 1, null],
    [shift.adminAssignment, job.base, "OCV1-03 Admin Assignment", "2098-07-11T09:00:00+09", 2, null],
  ];
  const shiftValues = rows.map(([sid, jid, label, start, capacity, deadline]) => `('${sid}','${jid}','${label}','${start}','${start.replace("09:00:00", "17:00:00")}','${start}',${capacity},'recruiting'${deadline ? `,'${deadline}'` : ",null"})`).join(",\n");
  sql(`begin;
    insert into public.workplaces(id,branch_id,name,address) values
      ('${workplace.own}','${branch.own}','OCV1-03 Workplace','QA Address'),
      ('${workplace.foreign}','${branch.foreign}','OCV1-03 Foreign Workplace','Foreign Address');
    insert into public.projects(id,branch_id,name,status,start_date,end_date) values
      ('${project.own}','${branch.own}','OCV1-03 Project','recruiting','2098-07-01','2098-07-31'),
      ('${project.foreign}','${branch.foreign}','OCV1-03 Foreign Project','recruiting','2098-07-01','2098-07-31');
    insert into public.jobs(id,project_id,workplace_id,name,status,description,hourly_wage) values
      ('${job.base}','${project.own}','${workplace.own}','OCV1-03 Job','recruiting','Application QA',1500),
      ('${job.skill}','${project.own}','${workplace.own}','OCV1-03 Skill Job','recruiting','Missing skill QA',1500),
      ('${job.foreign}','${project.foreign}','${workplace.foreign}','OCV1-03 Foreign Job','recruiting','Foreign QA',1500);
    insert into public.skills(id,code,name,is_active) values ('${skill}','OCV1-03-SKILL','OCV1-03 Required Skill',true);
    insert into public.job_skill_requirements(job_id,skill_id) values ('${job.skill}','${skill}');
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status,application_deadline) values ${shiftValues};
    insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by) values
      ('${assignment.full}','${shift.full}','${worker.b}','manager','assigned','${actor.manager}'),
      ('${assignment.own}','${shift.assigned}','${worker.a}','manager','assigned','${actor.manager}');
    insert into public.shift_applications(id,shift_slot_id,worker_id,status) values
      ('${application.accepted}','${shift.accepted}','${worker.a}','accepted'),
      ('${application.rejected}','${shift.rejected}','${worker.a}','rejected'),
      ('${application.withdrawn}','${shift.withdrawn}','${worker.a}','withdrawn');
  commit;`);
}

async function test() {
  const apply = (profileId, shiftId, requestKey) => result(profileId, `public.apply_to_own_shift('${shiftId}','${requestKey}')`);
  const withdraw = (profileId, shiftId, requestKey) => result(profileId, `public.withdraw_own_shift_application('${shiftId}','${requestKey}')`);

  const applied = apply(actor.workerA, shift.applyWithdraw, key(1));
  pass("successful apply creates applied state", applied.ok && applied.outcome === "applied" && applied.applicationState === "applied");
  pass("successful apply creates exactly one canonical row", sql(`select count(*) from public.shift_applications where shift_slot_id='${shift.applyWithdraw}' and worker_id='${worker.a}'`) === "1");
  const replay = apply(actor.workerA, shift.applyWithdraw, key(1));
  pass("same-key apply retry replays stable result", replay.ok && replay.outcome === "applied" && replay.replayed === true);
  const duplicate = apply(actor.workerA, shift.applyWithdraw, key(2));
  pass("different-key duplicate converges to existing applied", duplicate.ok && duplicate.outcome === "existing_applied");
  pass("duplicate apply creates no second row", sql(`select count(*) from public.shift_applications where shift_slot_id='${shift.applyWithdraw}'`) === "1");

  pass("eligibility changed before submit is denied", apply(actor.workerA, shift.missingSkill, key(3)).outcome === "not_eligible");
  pass("deadline passed before submit is denied", apply(actor.workerA, shift.deadline, key(4)).outcome === "deadline_passed");
  pass("capacity became full before submit is denied", apply(actor.workerA, shift.full, key(5)).outcome === "capacity_full");
  pass("already assigned Worker is denied", apply(actor.workerA, shift.assigned, key(6)).outcome === "already_assigned");
  pass("foreign Branch is safely unavailable", apply(actor.workerA, shift.foreign, key(7)).outcome === "unavailable");

  const withdrawn = withdraw(actor.workerA, shift.applyWithdraw, key(8));
  pass("successful withdraw transitions applied to withdrawn", withdrawn.ok && withdrawn.outcome === "withdrawn" && withdrawn.applicationState === "withdrawn");
  const withdrawReplay = withdraw(actor.workerA, shift.applyWithdraw, key(8));
  pass("same-key withdraw retry replays stable result", withdrawReplay.ok && withdrawReplay.outcome === "withdrawn" && withdrawReplay.replayed === true);
  pass("different-key duplicate withdraw is stable", withdraw(actor.workerA, shift.applyWithdraw, key(9)).outcome === "already_withdrawn");
  pass("withdrawn Application cannot reapply", apply(actor.workerA, shift.applyWithdraw, key(10)).outcome === "application_withdrawn");
  pass("accepted Application cannot withdraw", withdraw(actor.workerA, shift.accepted, key(11)).outcome === "application_accepted");
  pass("rejected Application cannot withdraw", withdraw(actor.workerA, shift.rejected, key(12)).outcome === "application_rejected");
  pass("terminal Application states remain unchanged", sql(`select string_agg(status,',' order by shift_slot_id) from public.shift_applications where shift_slot_id in ('${shift.accepted}','${shift.rejected}','${shift.withdrawn}')`) === "accepted,rejected,withdrawn");

  const [concurrentA, concurrentB] = await Promise.all([
    concurrentResult(actor.workerA, `public.apply_to_own_shift('${shift.concurrent}','${key(13)}')`),
    concurrentResult(actor.workerB, `public.apply_to_own_shift('${shift.concurrent}','${key(13)}')`),
  ]);
  pass("concurrent applicants can both become applied for one remaining slot", concurrentA.ok && concurrentB.ok && sql(`select count(*) from public.shift_applications where shift_slot_id='${shift.concurrent}' and status='applied'`) === "2");
  pass("Applications do not reserve or consume capacity", sql(`select count(*) from public.assignments where shift_slot_id='${shift.concurrent}'`) === "0");

  const adminApply = apply(actor.workerA, shift.adminAssignment, key(14));
  pass("Admin review sees submitted Application", adminApply.ok && sql(roleSql(actor.manager, `select count(*) from public.shift_applications where shift_slot_id='${shift.adminAssignment}' and status='applied'`)).split(/\r?\n/).at(-1) === "1");
  sql(`begin; set local role authenticated; set local request.jwt.claims='{"sub":"${actor.manager}","role":"authenticated"}'; update public.shift_applications set status='accepted',reviewed_at=now(),reviewed_by='${actor.manager}' where shift_slot_id='${shift.adminAssignment}' and worker_id='${worker.a}' and status='applied'; commit;`);
  const assignmentResult = result(actor.manager, `public.ensure_candidate_assignment('${shift.adminAssignment}','${worker.a}','accepted_application','ocv1-03-admin-assignment')`);
  pass("accepted Application connects to canonical Assignment command", assignmentResult.ok && assignmentResult.outcome === "assignment_created" && sql(`select source from public.assignments where shift_slot_id='${shift.adminAssignment}' and worker_id='${worker.a}'`) === "application");

  const directInsert = sql(roleSql(actor.workerA, `insert into public.shift_applications(id,shift_slot_id,worker_id,status) values('${id("5", 99)}','${shift.missingSkill}','${worker.a}','applied')`), true);
  pass("Worker direct table mutation is denied", /row-level security|permission denied/i.test(directInsert));
  pass("anon cannot execute apply command", /permission denied/i.test(sql(roleSql("00000000-0000-0000-0000-000000000000", `select public.apply_to_own_shift('${shift.applyWithdraw}','${key(15)}')`, "anon"), true)));
  pass("Manager gains no Worker command authority", result(actor.manager, `public.apply_to_own_shift('${shift.concurrent}','${key(16)}')`).outcome === "unavailable");
  pass("idempotency key cannot be reused for another operation", withdraw(actor.workerA, shift.adminAssignment, key(14)).outcome === "IDEMPOTENCY_CONFLICT");
}

const mode = process.argv[2] ?? "test";
if (mode === "cleanup") {
  cleanup();
  console.log("OCV1-03 fixtures cleaned.");
} else if (mode === "setup-browser") {
  setup();
  console.log("OCV1-03 browser fixtures retained.");
} else {
  try { setup(); await test(); }
  finally { cleanup(); }
  pass("dedicated fixtures cleaned", sql(`select (select count(*) from public.shift_slots where id::text like 'b2730000-0000-0000-0000-%') + (select count(*) from private.worker_application_command_receipts where shift_id::text like 'b2730000-0000-0000-0000-%')`) === "0");
  console.log(`Worker Application Command final: ${passed}/${passed} passed`);
}
