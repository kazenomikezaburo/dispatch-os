import { execFileSync } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const workerProfile = "a0000000-0000-0000-0000-000000000001";
const managerProfile = "a0000000-0000-0000-0000-000000000004";
const workerId = "c0000000-0000-0000-0000-000000000001";
const jobId = "10000000-0000-0000-0000-000000000001";
const prefix = "98000000-0000-4000";
const ids = Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
  const n = String(index + 1).padStart(12, "0");
  return [`W${index + 1}`, { shift: `${prefix}-8001-${n}`, assignment: `${prefix}-8002-${n}` }];
}));

function run(sql) {
  return execFileSync("docker", dockerArgs, { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function asRole(profileId, sql) {
  return `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${profileId}","role":"authenticated"}'; ${sql} commit;`;
}
function json(sql) { return JSON.parse(run(sql).split(/\r?\n/).at(-1)); }
function create(name, category, message) {
  return json(asRole(workerProfile, `select public.create_operational_incident('${ids[name].assignment}'::uuid,'${category}',${message === null ? "null" : `'${message.replaceAll("'", "''")}'`},'ui-27d-${name}-create')::text;`));
}
function transition(command, profileId, incidentId, version, key) {
  return json(asRole(profileId, `select public.${command}_operational_incident('${incidentId}'::uuid,${version},'${key}')::text;`));
}
function cleanup() {
  run(`begin;
delete from public.operational_incident_events where incident_id in (select id from public.operational_incidents where assignment_id::text like '98000000-0000-%');
delete from public.operational_incidents where assignment_id::text like '98000000-0000-%';
delete from public.assignments where id::text like '98000000-0000-%';
delete from public.shift_slots where id::text like '98000000-0000-%';
commit;`);
}

if (process.argv.includes("--cleanup")) {
  cleanup();
  console.log("Worker Help Request fixtures cleaned.");
  process.exit(0);
}

cleanup();
const assignmentStatuses = ["assigned", "confirmed", "assigned", "confirmed", "assigned", "confirmed", "assigned", "confirmed"];
const fixtureSql = assignmentStatuses.map((status, index) => {
  const name = `W${index + 1}`;
  const shiftStatus = "confirmed";
  return `insert into public.shift_slots (id,job_id,starts_at,ends_at,required_workers,status) values ('${ids[name].shift}','${jobId}',now()+interval '${index + 2} days',now()+interval '${index + 2} days 8 hours',1,'${shiftStatus}');
insert into public.assignments (id,shift_slot_id,worker_id,source,status) values ('${ids[name].assignment}','${ids[name].shift}','${workerId}','manager','${status}');`;
}).join("\n");
run(`begin; ${fixtureSql} commit;`);

create("W3", "site_access", "入口が分かりません");
const w4 = create("W4", "assignment_instruction", "担当場所を確認したいです");
transition("acknowledge", managerProfile, w4.incident_id, w4.version, "ui-27d-W4-ack");
const w5 = create("W5", "schedule_transport", "電車が遅れています");
const w5Ack = transition("acknowledge", managerProfile, w5.incident_id, w5.version, "ui-27d-W5-ack");
transition("resolve", managerProfile, w5.incident_id, w5Ack.version, "ui-27d-W5-resolve");
const w6 = create("W6", "other", "確認事項があります");
transition("retract", workerProfile, w6.incident_id, w6.version, "ui-27d-W6-retract");
const w7 = create("W7", "health_safety", "安全について確認したいです");
const w7Ack = transition("acknowledge", managerProfile, w7.incident_id, w7.version, "ui-27d-W7-ack");
transition("resolve", managerProfile, w7.incident_id, w7Ack.version, "ui-27d-W7-resolve");
const w8 = create("W8", "other", "勤務前の確認です");
transition("retract", workerProfile, w8.incident_id, w8.version, "ui-27d-W8-retract");
run(`begin;
update public.assignments set status='completed' where id='${ids.W7.assignment}';
update public.shift_slots set status='cancelled' where id='${ids.W8.shift}';
commit;`);

console.log(JSON.stringify({ assignments: Object.fromEntries(Object.entries(ids).map(([name, value]) => [name, value.assignment])) }));
