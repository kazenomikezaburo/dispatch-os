import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const managerId = "a0000000-0000-0000-0000-000000000004";
const workerAId = "c0000000-0000-0000-0000-000000000001";
const workerBId = "c0000000-0000-0000-0000-000000000002";
const jobId = "10000000-0000-0000-0000-000000000001";
const ids = {
  target: "f3000000-0000-0000-0000-000000000001",
  overlap: "f3000000-0000-0000-0000-000000000002",
  touching: "f3000000-0000-0000-0000-000000000003",
};
const assignments = {
  target: "f3100000-0000-0000-0000-000000000001",
  overlap: "f3100000-0000-0000-0000-000000000002",
  touching: "f3100000-0000-0000-0000-000000000003",
  inactive: "f3100000-0000-0000-0000-000000000004",
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

function facts(functionName, workerId = workerAId) {
  return JSON.parse(scalar(roleSql(managerId, `select public.${functionName}('${workerId}','${ids.target}')::text;`)));
}

function cleanup() {
  run(`begin;
    delete from public.assignments where id in (
      '${assignments.target}',
      '${assignments.overlap}',
      '${assignments.touching}',
      '${assignments.inactive}'
    );
    delete from public.shift_slots where id in (
      '${ids.target}',
      '${ids.overlap}',
      '${ids.touching}'
    );
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
  run(`begin;
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,required_workers,status) values
      ('${ids.target}','${jobId}','S2G1 target','2100-01-10T00:00:00Z','2100-01-10T04:00:00Z',2,'recruiting'),
      ('${ids.overlap}','${jobId}','S2G1 overlap','2100-01-10T02:00:00Z','2100-01-10T05:00:00Z',2,'recruiting'),
      ('${ids.touching}','${jobId}','S2G1 touching','2100-01-10T04:00:00Z','2100-01-10T06:00:00Z',2,'recruiting');
    insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by) values
      ('${assignments.target}','${ids.target}','${workerAId}','manager','assigned','${managerId}'),
      ('${assignments.touching}','${ids.touching}','${workerAId}','manager','assigned','${managerId}'),
      ('${assignments.inactive}','${ids.overlap}','${workerAId}','manager','cancelled_by_company','${managerId}');
  commit;`);

  const unassignedAvailability = facts("get_worker_shift_availability_facts", workerBId);
  const unassignedCandidate = facts("get_worker_shift_candidate_eligibility", workerBId);
  pass("unassigned Worker keeps none target fact", unassignedAvailability.targetShiftAssignment.state === "none" && unassignedAvailability.targetShiftAssignment.assignmentId === null);
  pass("unassigned eligible Worker behavior is unchanged", unassignedCandidate.candidateEligible === true && unassignedCandidate.overlapEligible === true);

  const targetAvailability = facts("get_worker_shift_availability_facts");
  pass("target Shift Assignment is not a conflict", targetAvailability.overlapEligible === true && targetAvailability.conflictingAssignments.length === 0);
  pass("target Shift canonical Assignment is returned", targetAvailability.targetShiftAssignment.state === "active_existing" && targetAvailability.targetShiftAssignment.assignmentId === assignments.target && targetAvailability.targetShiftAssignment.status === "assigned");
  pass("touching Shift and inactive Assignment history do not conflict", targetAvailability.overlapReasonCodes.length === 0);

  const targetCandidate = facts("get_worker_shift_candidate_eligibility");
  pass("Candidate composer exposes the same target Assignment", targetCandidate.targetShiftAssignment.assignmentId === assignments.target && targetCandidate.candidateEligible === true);

  run(`insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by)
    values('${assignments.overlap}','${ids.overlap}','${workerAId}','manager','confirmed','${managerId}');`);
  const overlappingAvailability = facts("get_worker_shift_availability_facts");
  const overlappingCandidate = facts("get_worker_shift_candidate_eligibility");
  pass("other overlapping Shift remains a conflict", overlappingAvailability.overlapEligible === false && overlappingAvailability.conflictingAssignments.length === 1 && overlappingAvailability.conflictingAssignments[0].assignmentId === assignments.overlap);
  pass("other overlap blocks candidate without hiding target Assignment", overlappingCandidate.candidateEligible === false && overlappingCandidate.targetShiftAssignment.assignmentId === assignments.target);
  pass("deterministic reason ordering remains unchanged", overlappingCandidate.blockingReasons.map((item) => item.code).join(",") === "assignment_time_conflict");

  pass("internal candidate implementation is not runtime-executable", scalar(`select has_function_privilege('authenticated','public.get_worker_shift_candidate_eligibility_internal(uuid,uuid)','execute')::text;`) === "false");
  const anon = run(`begin; set local role anon; select public.get_worker_shift_candidate_eligibility('${workerAId}','${ids.target}'); commit;`, { allowFailure: true });
  pass("anon execution remains denied", anon.includes("permission denied"));

  cleanup();
  pass("STAFF-2G.1 fixtures are fully cleaned", scalar(`select (select count(*) from public.assignments where id::text like 'f3100000-0000-0000-0000-%') + (select count(*) from public.shift_slots where id::text like 'f3000000-0000-0000-0000-%');`) === "0");
  console.log(`Target Shift Assignment Facts: ${passed}/${passed} passed`);
} finally {
  cleanup();
}
