import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const actor = { worker: "a0000000-0000-0000-0000-000000000001", manager: "a0000000-0000-0000-0000-000000000004", admin: "a0000000-0000-0000-0000-000000000005" };
const worker = { own: "c0000000-0000-0000-0000-000000000001", other: "c0000000-0000-0000-0000-000000000002" };
const branch = { own: "b0000000-0000-0000-0000-000000000001", foreign: "b0000000-0000-0000-0000-000000000002" };
const id = (kind, n) => `b26${kind}0000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const workplace = { own: id("0", 1), foreign: id("0", 2) };
const project = { own: id("1", 1), closed: id("1", 2), foreign: id("1", 3) };
const job = { base: id("2", 1), skill: id("2", 2), qualification: id("2", 3), inactive: id("2", 4), closed: id("2", 5), foreign: id("2", 6) };
const shift = Object.fromEntries(["eligible","unknown","consultable","unavailable","skill","qualification","inactive","conflictSource","conflictTarget","applied","accepted","rejected","withdrawn","full","assigned","deadline","closed","cancelled","completed","started","foreign","closedProject","preference","overApplied"].map((name, index) => [name, id("3", index + 1)]));
const assignment = { conflict: id("4", 1), full: id("4", 2), own: id("4", 3) };
const application = Object.fromEntries(["applied","accepted","rejected","withdrawn","overOwn","overOther"].map((name, index) => [name, id("5", index + 1)]));
const availability = Object.fromEntries(["eligible","consultable","unavailable","preference"].map((name, index) => [name, id("6", index + 1)]));
const skill = { missing: id("7", 1), inactive: id("7", 2) };
const qualification = id("8", 1);

function sql(statement, allowFailure = false) {
  try { return execFileSync("docker", psql, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (error) { if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`; throw error; }
}
function asRole(profileId, expression, role = "authenticated") { return sql(`begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; select (${expression})::text; rollback;`).split(/\r?\n/).at(-1); }
function projection(profileId = actor.worker) { return JSON.parse(asRole(profileId, "public.get_own_recruitment_shifts(48,0,null)")); }
function byId(result, shiftId) { return result.items.find((item) => item.shiftId === shiftId); }
let passed = 0;
function pass(name, condition) { assert.ok(condition, name); passed += 1; console.log(`PASS ${name}`); }

function cleanup() {
  sql(`begin;
    set local session_replication_role = replica;
    delete from public.shift_applications where id::text like 'b2650000-0000-0000-0000-%';
    delete from public.assignments where id::text like 'b2640000-0000-0000-0000-%';
    delete from public.worker_availability_intervals where id::text like 'b2660000-0000-0000-0000-%';
    delete from public.worker_work_conditions where worker_id='${worker.own}' and preferred_area_note='OCV1-02B-QA';
    delete from public.job_skill_requirements where job_id::text like 'b2620000-0000-0000-0000-%';
    delete from public.job_qualification_requirements where job_id::text like 'b2620000-0000-0000-0000-%';
    delete from public.worker_skills where skill_id::text like 'b2670000-0000-0000-0000-%';
    delete from public.worker_qualifications where qualification_id='${qualification}';
    delete from public.shift_slots where id::text like 'b2630000-0000-0000-0000-%';
    delete from public.jobs where id::text like 'b2620000-0000-0000-0000-%';
    delete from public.project_history_events where project_id::text like 'b2610000-0000-0000-0000-%';
    delete from public.projects where id::text like 'b2610000-0000-0000-0000-%';
    delete from public.workplaces where id::text like 'b2600000-0000-0000-0000-%';
    delete from public.skills where id::text like 'b2670000-0000-0000-0000-%';
    delete from public.qualifications where id='${qualification}';
  commit;`);
}

function setup() {
  cleanup();
  const rows = [
    [shift.eligible, job.base, "QA Eligible", "2098-06-01T00:00:00+09", "2098-06-01T01:00:00+09", "recruiting", 2, "2098-05-31T18:00:00+09"],
    [shift.unknown, job.base, "QA Unknown", "2098-06-02T09:00:00+09", "2098-06-02T17:00:00+09", "recruiting", 2, null],
    [shift.consultable, job.base, "QA Consultable", "2098-06-03T09:00:00+09", "2098-06-03T17:00:00+09", "recruiting", 2, null],
    [shift.unavailable, job.base, "QA Unavailable", "2098-06-04T09:00:00+09", "2098-06-04T17:00:00+09", "recruiting", 2, null],
    [shift.skill, job.skill, "QA Missing Skill", "2098-06-05T09:00:00+09", "2098-06-05T17:00:00+09", "recruiting", 2, null],
    [shift.qualification, job.qualification, "QA Missing Qualification", "2098-06-06T09:00:00+09", "2098-06-06T17:00:00+09", "recruiting", 2, null],
    [shift.inactive, job.inactive, "QA Inactive Requirement", "2098-06-07T09:00:00+09", "2098-06-07T17:00:00+09", "recruiting", 2, null],
    [shift.conflictSource, job.base, "QA Conflict Source", "2098-06-08T09:00:00+09", "2098-06-08T17:00:00+09", "confirmed", 2, null],
    [shift.conflictTarget, job.base, "QA Conflict Target", "2098-06-08T13:00:00+09", "2098-06-08T20:00:00+09", "recruiting", 2, null],
    [shift.applied, job.base, "QA Applied", "2098-06-09T09:00:00+09", "2098-06-09T17:00:00+09", "recruiting", 2, null],
    [shift.accepted, job.base, "QA Accepted", "2098-06-10T09:00:00+09", "2098-06-10T17:00:00+09", "recruiting", 2, null],
    [shift.rejected, job.base, "QA Rejected", "2098-06-11T09:00:00+09", "2098-06-11T17:00:00+09", "recruiting", 2, null],
    [shift.withdrawn, job.base, "QA Withdrawn", "2098-06-12T09:00:00+09", "2098-06-12T17:00:00+09", "recruiting", 2, null],
    [shift.full, job.base, "QA Full", "2098-06-13T09:00:00+09", "2098-06-13T17:00:00+09", "recruiting", 1, null],
    [shift.assigned, job.base, "QA Assigned", "2098-06-14T09:00:00+09", "2098-06-14T17:00:00+09", "recruiting", 1, null],
    [shift.deadline, job.base, "QA Deadline", "2098-06-15T09:00:00+09", "2098-06-15T17:00:00+09", "recruiting", 2, "2026-01-01T00:00:00Z"],
    [shift.closed, job.base, "QA Closed", "2098-06-16T09:00:00+09", "2098-06-16T17:00:00+09", "closed", 2, null],
    [shift.cancelled, job.base, "QA Cancelled", "2098-06-17T09:00:00+09", "2098-06-17T17:00:00+09", "cancelled", 2, null],
    [shift.completed, job.base, "QA Completed", "2098-06-18T09:00:00+09", "2098-06-18T17:00:00+09", "completed", 2, null],
    [shift.started, job.base, "QA Started", "2020-06-19T09:00:00+09", "2020-06-19T17:00:00+09", "recruiting", 2, null],
    [shift.foreign, job.foreign, "QA Foreign", "2098-06-20T09:00:00+09", "2098-06-20T17:00:00+09", "recruiting", 2, null],
    [shift.closedProject, job.closed, "QA Closed Project", "2098-06-21T09:00:00+09", "2098-06-21T17:00:00+09", "recruiting", 2, null],
    [shift.preference, job.base, "QA Preference", "2098-06-22T09:00:00+09", "2098-06-22T17:00:00+09", "recruiting", 2, null],
    [shift.overApplied, job.base, "QA Over Applied", "2098-06-23T09:00:00+09", "2098-06-23T17:00:00+09", "recruiting", 1, null],
  ];
  const shiftValues = rows.map(([sid,jid,label,start,end,status,capacity,deadline]) => `('${sid}','${jid}','${label}','${start}','${end}','${start}',${capacity},'${status}'${deadline ? `,'${deadline}'` : ",null"})`).join(",\n");
  sql(`begin;
    insert into public.workplaces(id,branch_id,name,address,map_url,access_note,meeting_note) values
      ('${workplace.own}','${branch.own}','OCV1 QA Workplace','QA Address','https://example.com/map','QA Access','QA Meeting'),
      ('${workplace.foreign}','${branch.foreign}','OCV1 QA Foreign Workplace','Foreign QA Address',null,null,null);
    insert into public.projects(id,branch_id,name,status,start_date,end_date) values
      ('${project.own}','${branch.own}','OCV1 QA Project','recruiting','2098-06-01','2098-06-30'),
      ('${project.closed}','${branch.own}','OCV1 QA Closed Project','closed','2098-06-01','2098-06-30'),
      ('${project.foreign}','${branch.foreign}','OCV1 QA Foreign Project','recruiting','2098-06-01','2098-06-30');
    insert into public.jobs(id,project_id,workplace_id,name,status,description,hourly_wage,transportation_fee_cap,dress_code,belongings_note,meal_notes,recruitment_notes,manual_url) values
      ('${job.base}','${project.own}','${workplace.own}','OCV1 QA Job','recruiting','QA Work Description',1500,800,'QA Clothing','QA Belongings','QA Meal','QA Recruitment','https://example.com/manual'),
      ('${job.skill}','${project.own}','${workplace.own}','OCV1 QA Skill Job','recruiting','Skill work',1500,800,'QA Clothing','QA Belongings','QA Meal','QA Recruitment',null),
      ('${job.qualification}','${project.own}','${workplace.own}','OCV1 QA Qualification Job','recruiting','Qualification work',1500,800,'QA Clothing','QA Belongings','QA Meal','QA Recruitment',null),
      ('${job.inactive}','${project.own}','${workplace.own}','OCV1 QA Inactive Job','recruiting','Inactive work',1500,800,'QA Clothing','QA Belongings','QA Meal','QA Recruitment',null),
      ('${job.closed}','${project.closed}','${workplace.own}','OCV1 QA Closed Job','recruiting','Closed project work',1500,800,null,null,null,null,null),
      ('${job.foreign}','${project.foreign}','${workplace.foreign}','OCV1 QA Foreign Job','recruiting','Foreign work',1500,800,null,null,null,null,null);
    insert into public.skills(id,code,name,is_active) values ('${skill.missing}','OCV1-QA-SKILL','QA Required Skill',true),('${skill.inactive}','OCV1-QA-INACTIVE','QA Inactive Skill',true);
    insert into public.qualifications(id,code,name,is_active,expiry_policy) values ('${qualification}','OCV1-QA-QUAL','QA Required Qualification',true,'none');
    insert into public.job_skill_requirements(job_id,skill_id) values ('${job.skill}','${skill.missing}'),('${job.inactive}','${skill.inactive}');
    insert into public.job_qualification_requirements(job_id,qualification_id) values ('${job.qualification}','${qualification}');
    update public.skills set is_active=false where id='${skill.inactive}';
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status,application_deadline) values ${shiftValues};
    insert into public.worker_availability_intervals(id,worker_id,kind,starts_at,ends_at,created_by_profile_id) values
      ('${availability.eligible}','${worker.own}','available','2098-06-01T00:00:00+09','2098-06-01T01:00:00+09','${actor.worker}'),
      ('${availability.consultable}','${worker.own}','consultable','2098-06-03T09:00:00+09','2098-06-03T17:00:00+09','${actor.worker}'),
      ('${availability.unavailable}','${worker.own}','unavailable','2098-06-04T12:00:00+09','2098-06-04T13:00:00+09','${actor.worker}'),
      ('${availability.preference}','${worker.own}','available','2098-06-22T09:00:00+09','2098-06-22T17:00:00+09','${actor.worker}');
    insert into public.worker_work_conditions(worker_id,preferred_start_local,preferred_end_local,preferred_ends_next_day,preferred_area_note,is_active,updated_by_profile_id) values ('${worker.own}','00:00','01:00',false,'OCV1-02B-QA',true,'${actor.worker}');
    insert into public.assignments(id,shift_slot_id,worker_id,source,status,assigned_by) values
      ('${assignment.conflict}','${shift.conflictSource}','${worker.own}','manager','assigned','${actor.manager}'),
      ('${assignment.full}','${shift.full}','${worker.other}','manager','assigned','${actor.manager}'),
      ('${assignment.own}','${shift.assigned}','${worker.own}','manager','assigned','${actor.manager}');
    insert into public.shift_applications(id,shift_slot_id,worker_id,status) values
      ('${application.applied}','${shift.applied}','${worker.own}','applied'),('${application.accepted}','${shift.accepted}','${worker.own}','accepted'),
      ('${application.rejected}','${shift.rejected}','${worker.own}','rejected'),('${application.withdrawn}','${shift.withdrawn}','${worker.own}','withdrawn'),
      ('${application.overOwn}','${shift.overApplied}','${worker.own}','applied'),('${application.overOther}','${shift.overApplied}','${worker.other}','applied');
  commit;`);
}

function test() {
  const result = projection();
  pass("same-Branch published Shift is visible", Boolean(byId(result, shift.eligible)));
  pass("eligible Shift is available", byId(result, shift.eligible)?.state === "available");
  pass("unknown Availability is warning and nonblocking", byId(result, shift.unknown)?.state === "available_with_warning");
  pass("consultable Availability is warning and nonblocking", byId(result, shift.consultable)?.state === "available_with_warning");
  pass("explicit unavailable blocks with safe reason", byId(result, shift.unavailable)?.state === "not_eligible" && byId(result, shift.unavailable).eligibility.safeReasons.includes("availability_unavailable"));
  pass("missing Skill is safely blocked", byId(result, shift.skill)?.state === "not_eligible" && byId(result, shift.skill).eligibility.safeReasons.includes("required_conditions_not_met"));
  pass("missing Qualification is safely blocked", byId(result, shift.qualification)?.state === "not_eligible");
  pass("inactive requirement master is safely blocked", byId(result, shift.inactive)?.state === "not_eligible");
  pass("other-Shift conflict is redacted", byId(result, shift.conflictTarget)?.eligibility.safeReasons.join() === "other_scheduled_shift_overlaps");
  pass("preference mismatch remains nonblocking warning", byId(result, shift.preference)?.state === "available_with_warning");
  for (const [name, expected] of [["applied","applied"],["accepted","accepted_waiting_assignment"],["rejected","rejected"],["withdrawn","withdrawn"]]) pass(`Application ${name} state`, byId(result, shift[name])?.state === expected);
  pass("capacity snapshot and full state", byId(result, shift.full)?.remainingCapacity === 0 && byId(result, shift.full)?.state === "capacity_full");
  pass("own active Assignment excludes Shift", !byId(result, shift.assigned));
  pass("deadline passed remains visible and unavailable", byId(result, shift.deadline)?.state === "deadline_passed");
  pass("Project/Shift lifecycle gates exclude unpublished rows", [shift.closed,shift.cancelled,shift.completed,shift.started,shift.closedProject].every((value) => !byId(result, value)));
  pass("foreign Branch is isolated", !byId(result, shift.foreign));
  pass("Applications do not consume capacity", byId(result, shift.overApplied)?.remainingCapacity === 1 && byId(result, shift.overApplied)?.state === "applied");
  const serialized = JSON.stringify(result);
  pass("safe projection redacts privileged facts", !/assignmentId|conflictingAssignments|credential|workerId|branchId|candidateEligible|placement|authorization/i.test(serialized));
  pass("anon cannot execute projection", sql(`begin; set local role anon; select public.get_own_recruitment_shifts(1,0,null); rollback;`, true).includes("permission denied"));
  for (const profileId of [actor.manager, actor.admin]) { const value = JSON.parse(asRole(profileId, "public.get_own_recruitment_shifts(48,0,null)")); pass(`${profileId === actor.manager ? "Manager" : "Admin"} gains no Worker projection`, value.items.length === 0); }
  pass("missing detail is safe empty", JSON.parse(asRole(actor.worker, `public.get_own_recruitment_shifts(1,0,'ffffffff-ffff-ffff-ffff-ffffffffffff')`)).items.length === 0);
  console.log(`Worker Recruitment Discovery: ${passed}/${passed} passed`);
}

const mode = process.argv[2] ?? "test";
if (mode === "cleanup") { cleanup(); console.log("Worker recruitment QA fixtures cleaned: 0 remaining expected."); }
else if (mode === "setup-browser") { setup(); test(); console.log("Worker recruitment QA fixtures retained for browser QA."); }
else { try { setup(); test(); } finally { cleanup(); } pass("dedicated fixtures cleaned", sql(`select (select count(*) from public.shift_slots where id::text like 'b2630000-0000-0000-0000-%') + (select count(*) from public.projects where id::text like 'b2610000-0000-0000-0000-%');`) === "0"); console.log(`Worker Recruitment Discovery final: ${passed}/${passed} passed`); }
