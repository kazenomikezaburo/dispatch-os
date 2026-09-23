import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const actors = {
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const branches = {
  own: "b0000000-0000-0000-0000-000000000001",
  foreign: "b0000000-0000-0000-0000-000000000002",
};
const jobs = {
  own: "10000000-0000-0000-0000-000000000001",
  foreign: "10000000-0000-0000-0000-000000000003",
};
const shiftId = (n) => `f4000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const workerId = (n) => `f4100000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const appId = (n) => `f4200000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const assignmentId = (n) => `f4300000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const qualificationId = "f4400000-0000-0000-0000-000000000001";

function run(sql, { allowFailure = false } = {}) {
  try {
    return execFileSync("docker", dockerArgs, { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    throw error;
  }
}

function runAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = execFile("docker", dockerArgs, { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve(stdout.trim());
    });
    child.stdin.end(sql);
  });
}

function roleSql(profileId, body) {
  return `begin; set local role authenticated; set local request.jwt.claims='{"sub":"${profileId}","role":"authenticated"}'; ${body} commit;`;
}

function scalar(sql) {
  return run(sql).split(/\r?\n/).at(-1);
}

function commandSql(actorId, shift, worker, path, key) {
  return roleSql(actorId, `select public.ensure_candidate_assignment('${shift}','${worker}','${path}','${key}')::text;`);
}

function command(actorId, shift, worker, path, key) {
  return JSON.parse(scalar(commandSql(actorId, shift, worker, path, key)));
}

function cleanup() {
  run(`begin;
    drop trigger if exists s2g2_unexpected_assignment_failure on public.assignments;
    drop function if exists private.s2g2_raise_assignment_failure();
    delete from private.candidate_assignment_command_receipts
      where shift_id::text like 'f4000000-0000-0000-0000-%'
         or worker_id::text like 'f4100000-0000-0000-0000-%';
    delete from public.assignments
      where shift_slot_id::text like 'f4000000-0000-0000-0000-%'
         or id::text like 'f4300000-0000-0000-0000-%';
    delete from public.shift_applications where id::text like 'f4200000-0000-0000-0000-%';
    delete from public.worker_availability_intervals where worker_id::text like 'f4100000-0000-0000-0000-%';
    delete from public.job_qualification_requirements where qualification_id='${qualificationId}';
    delete from public.worker_qualifications where qualification_id='${qualificationId}';
    delete from public.qualifications where id='${qualificationId}';
    delete from public.shift_slots where id::text like 'f4000000-0000-0000-0000-%';
    delete from public.workers where id::text like 'f4100000-0000-0000-0000-%';
  commit;`);
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

try {
  cleanup();

  const workers = Array.from({ length: 24 }, (_, index) => workerId(index + 1));
  run(`begin;
    ${workers.map((id, index) => `insert into public.workers(id,staff_code,branch_id,display_name,status) values('${id}','S2G2-${String(index + 1).padStart(2, "0")}','${index === 23 ? branches.foreign : branches.own}','S2G2 Worker ${index + 1}','active');`).join("\n")}
    ${Array.from({ length: 22 }, (_, index) => {
      const n = index + 1;
      const status = n === 12 ? "draft" : "recruiting";
      const required = [3, 15, 17].includes(n) ? 1 : 3;
      const job = n === 22 ? jobs.foreign : jobs.own;
      const day = String(n).padStart(2, "0");
      return `insert into public.shift_slots(id,job_id,label,starts_at,ends_at,required_workers,status) values('${shiftId(n)}','${job}','S2G2 Shift ${n}','2101-01-${day}T00:00:00Z','2101-01-${day}T04:00:00Z',${required},'${status}');`;
    }).join("\n")}
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,required_workers,status)
      values('${shiftId(23)}','${jobs.own}','S2G2 overlap source','2101-01-04T02:00:00Z','2101-01-04T05:00:00Z',3,'confirmed');
    insert into public.shift_applications(id,shift_slot_id,worker_id,status) values
      ('${appId(1)}','${shiftId(2)}','${workers[1]}','accepted'),
      ('${appId(2)}','${shiftId(8)}','${workers[7]}','applied'),
      ('${appId(3)}','${shiftId(9)}','${workers[8]}','rejected'),
      ('${appId(4)}','${shiftId(10)}','${workers[9]}','withdrawn'),
      ('${appId(5)}','${shiftId(11)}','${workers[10]}','accepted');
    insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by) values
      ('${assignmentId(1)}','${shiftId(3)}','${workers[2]}','manager','assigned','${actors.manager}'),
      ('${assignmentId(2)}','${shiftId(23)}','${workers[3]}','manager','assigned','${actors.manager}'),
      ('${assignmentId(3)}','${shiftId(15)}','${workers[14]}','manager','assigned','${actors.manager}');
    insert into public.worker_availability_intervals(worker_id,kind,starts_at,ends_at,created_by_profile_id)
      values('${workers[4]}','unavailable','2101-01-05T01:00:00Z','2101-01-05T02:00:00Z','${actors.manager}');
  commit;`);

  pass("command is SECURITY DEFINER with an empty search_path", scalar(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ensure_candidate_assignment' and p.prosecdef and p.proconfig @> array['search_path=""'];`) === "1");
  pass("only authenticated can execute the command", scalar(`select has_function_privilege('authenticated','public.ensure_candidate_assignment(uuid,uuid,text,text)','execute')::text||'|'||has_function_privilege('anon','public.ensure_candidate_assignment(uuid,uuid,text,text)','execute')::text||'|'||has_function_privilege('service_role','public.ensure_candidate_assignment(uuid,uuid,text,text)','execute')::text;`) === "true|false|false");
  pass("receipt is private and runtime roles have no access", scalar(`select has_table_privilege('authenticated','private.candidate_assignment_command_receipts','select')::text||'|'||has_table_privilege('authenticated','private.candidate_assignment_command_receipts','insert')::text||'|'||has_table_privilege('anon','private.candidate_assignment_command_receipts','select')::text;`) === "false|false|false");

  const direct = command(actors.manager, shiftId(1), workers[0], "direct_admin", "s2g2-direct");
  pass("eligible unassigned Worker creates a direct Admin Assignment", direct.ok && direct.outcome === "assignment_created" && direct.source === "manager" && direct.assignmentId);
  pass("created Assignment is canonical and server attributed", scalar(`select (id='${direct.assignmentId}' and source='manager' and assigned_by='${actors.manager}' and status='assigned')::text from public.assignments where id='${direct.assignmentId}';`) === "true");

  const accepted = command(actors.manager, shiftId(2), workers[1], "accepted_application", "s2g2-accepted");
  pass("accepted Application path creates canonical Assignment", accepted.ok && accepted.outcome === "assignment_created" && accepted.source === "application");
  pass("accepted Application state is preserved", scalar(`select status from public.shift_applications where id='${appId(1)}';`) === "accepted");

  const existing = command(actors.manager, shiftId(3), workers[2], "direct_admin", "s2g2-existing");
  pass("existing Assignment is reused even at full capacity", existing.outcome === "existing_assignment" && existing.assignmentId === assignmentId(1) && scalar(`select count(*) from public.assignments where shift_slot_id='${shiftId(3)}';`) === "1");

  const overlap = command(actors.manager, shiftId(4), workers[3], "direct_admin", "s2g2-overlap");
  pass("other Shift overlap is re-evaluated as not eligible", overlap.outcome === "not_eligible" && overlap.blockingReasons.some((reason) => reason.code === "assignment_time_conflict"));
  const unavailable = command(actors.manager, shiftId(5), workers[4], "direct_admin", "s2g2-unavailable");
  pass("Availability changed after Picker render blocks creation", unavailable.outcome === "not_eligible" && unavailable.blockingReasons.some((reason) => reason.code === "availability_unavailable"));

  run(`update public.workers set status='inactive' where id='${workers[5]}'; update public.workers set status='suspended' where id='${workers[6]}';`);
  pass("inactive Worker is not eligible", command(actors.manager, shiftId(6), workers[5], "direct_admin", "s2g2-inactive").outcome === "not_eligible");
  pass("suspended Worker is not eligible", command(actors.manager, shiftId(7), workers[6], "direct_admin", "s2g2-suspended").outcome === "not_eligible");

  pass("applied Application requires a decision", command(actors.manager, shiftId(8), workers[7], "direct_admin", "s2g2-applied").outcome === "application_decision_required");
  pass("rejected Application is a controlled outcome", command(actors.manager, shiftId(9), workers[8], "direct_admin", "s2g2-rejected").outcome === "application_rejected");
  pass("withdrawn Application is a controlled outcome", command(actors.manager, shiftId(10), workers[9], "direct_admin", "s2g2-withdrawn").outcome === "application_withdrawn");
  pass("accepted Application cannot use direct path", command(actors.manager, shiftId(11), workers[10], "direct_admin", "s2g2-accepted-direct").outcome === "accepted_application_available");
  pass("unavailable Shift lifecycle rejects new Assignment", command(actors.manager, shiftId(12), workers[11], "direct_admin", "s2g2-draft").outcome === "shift_state_unavailable");

  const capacity = command(actors.manager, shiftId(15), workers[15], "direct_admin", "s2g2-capacity");
  pass("full Shift returns capacity reached", capacity.outcome === "capacity_reached");
  pass("Manager foreign Branch converges to unavailable", command(actors.manager, shiftId(22), workers[23], "direct_admin", "s2g2-foreign-manager").outcome === "unavailable");
  const adminCross = command(actors.admin, shiftId(22), workers[23], "direct_admin", "s2g2-foreign-admin");
  pass("System Admin can create across organization Branches", adminCross.outcome === "assignment_created");

  const replay = command(actors.manager, shiftId(1), workers[0], "direct_admin", "s2g2-direct");
  pass("same key and fingerprint replays original result", replay.replayed === true && replay.assignmentId === direct.assignmentId);
  const conflict = command(actors.manager, shiftId(13), workers[12], "direct_admin", "s2g2-direct");
  pass("same key with a different fingerprint conflicts", conflict.outcome === "IDEMPOTENCY_CONFLICT");

  const sameKeyResults = await Promise.all([
    runAsync(commandSql(actors.manager, shiftId(14), workers[13], "direct_admin", "s2g2-concurrent-same")),
    runAsync(commandSql(actors.manager, shiftId(14), workers[13], "direct_admin", "s2g2-concurrent-same")),
  ]);
  const sameKeyParsed = sameKeyResults.map((output) => JSON.parse(output.split(/\r?\n/).at(-1)));
  pass("concurrent same key converges to one result", new Set(sameKeyParsed.map((result) => result.assignmentId)).size === 1 && scalar(`select count(*) from public.assignments where shift_slot_id='${shiftId(14)}' and worker_id='${workers[13]}';`) === "1");

  const differentKeyResults = await Promise.all([
    runAsync(commandSql(actors.manager, shiftId(16), workers[16], "direct_admin", "s2g2-concurrent-a")),
    runAsync(commandSql(actors.manager, shiftId(16), workers[16], "direct_admin", "s2g2-concurrent-b")),
  ]);
  const differentKeyParsed = differentKeyResults.map((output) => JSON.parse(output.split(/\r?\n/).at(-1)));
  pass("different keys for same Worker converge to create then reuse", differentKeyParsed.map((result) => result.outcome).sort().join(",") === "assignment_created,existing_assignment" && scalar(`select count(*) from public.assignments where shift_slot_id='${shiftId(16)}';`) === "1");

  const finalCapacityResults = await Promise.all([
    runAsync(commandSql(actors.manager, shiftId(17), workers[17], "direct_admin", "s2g2-capacity-a")),
    runAsync(commandSql(actors.manager, shiftId(17), workers[18], "direct_admin", "s2g2-capacity-b")),
  ]);
  const finalCapacityParsed = finalCapacityResults.map((output) => JSON.parse(output.split(/\r?\n/).at(-1)));
  pass("final capacity concurrency admits exactly one Worker", finalCapacityParsed.map((result) => result.outcome).sort().join(",") === "assignment_created,capacity_reached" && scalar(`select count(*) from public.assignments where shift_slot_id='${shiftId(17)}';`) === "1");

  run(`create function private.s2g2_raise_assignment_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.worker_id='${workers[19]}' then raise exception 's2g2_expected_failure'; end if; return new; end; $$; create trigger s2g2_unexpected_assignment_failure before insert on public.assignments for each row execute function private.s2g2_raise_assignment_failure();`);
  const unexpected = run(commandSql(actors.manager, shiftId(18), workers[19], "direct_admin", "s2g2-rollback"), { allowFailure: true });
  pass("unexpected DB failure propagates", unexpected.includes("s2g2_expected_failure"));
  pass("unexpected DB failure rolls back Assignment and receipt", scalar(`select (select count(*) from public.assignments where shift_slot_id='${shiftId(18)}')::text||'|'||(select count(*) from private.candidate_assignment_command_receipts where idempotency_key='s2g2-rollback')::text;`) === "0|0");
  run(`drop trigger s2g2_unexpected_assignment_failure on public.assignments; drop function private.s2g2_raise_assignment_failure();`);

  run(`begin;
    insert into public.qualifications(id,code,name,expiry_policy) values('${qualificationId}','S2G2-QUAL','S2G2 Qualification','required');
    insert into public.job_qualification_requirements(job_id,qualification_id) values('${jobs.own}','${qualificationId}');
    insert into public.worker_qualifications(worker_id,qualification_id,valid_from,expires_on) values
      ('${workers[20]}','${qualificationId}','2100-01-01','2101-01-19'),
      ('${workers[21]}','${qualificationId}','2100-01-01','2102-01-01');
    update public.worker_qualifications set revoked_at='2101-01-01T00:00:00Z' where worker_id='${workers[21]}' and qualification_id='${qualificationId}';
  commit;`);
  const expired = command(actors.manager, shiftId(20), workers[20], "direct_admin", "s2g2-expired");
  const revoked = command(actors.manager, shiftId(21), workers[21], "direct_admin", "s2g2-revoked");
  pass("expired Qualification is re-evaluated", expired.outcome === "not_eligible" && expired.blockingReasons.some((reason) => reason.code === "qualification_expired"));
  pass("revoked Qualification is re-evaluated", revoked.outcome === "not_eligible" && revoked.blockingReasons.some((reason) => reason.code === "qualification_revoked"));

  pass("legacy Application command remains present and callable by authenticated", scalar(`select (to_regprocedure('public.create_assignment_from_application(uuid,uuid)') is not null)::text||'|'||has_function_privilege('authenticated','public.create_assignment_from_application(uuid,uuid)','execute')::text;`) === "true|true");

  cleanup();
  pass("STAFF-2G.2 fixtures are fully cleaned", scalar(`select (select count(*) from private.candidate_assignment_command_receipts where shift_id::text like 'f4000000-0000-0000-0000-%') + (select count(*) from public.assignments where shift_slot_id::text like 'f4000000-0000-0000-0000-%') + (select count(*) from public.shift_slots where id::text like 'f4000000-0000-0000-0000-%') + (select count(*) from public.workers where id::text like 'f4100000-0000-0000-0000-%');`) === "0");
  console.log(`Candidate Assignment Command: ${passed}/${passed} passed`);
} finally {
  cleanup();
}
