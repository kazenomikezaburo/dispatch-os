import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const actors = {
  workerA: "a0000000-0000-0000-0000-000000000001",
  workerB: "a0000000-0000-0000-0000-000000000002",
  workerForeign: "a0000000-0000-0000-0000-000000000003",
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const workers = {
  a: "c0000000-0000-0000-0000-000000000001",
  b: "c0000000-0000-0000-0000-000000000002",
  foreign: "c0000000-0000-0000-0000-000000000003",
  noRecipient: "99000000-0000-0000-0000-000000000099",
};
const jobs = {
  own: "10000000-0000-0000-0000-000000000001",
  foreign: "10000000-0000-0000-0000-000000000003",
};
const prefix = "99000000-0000-0000";
const ids = Object.fromEntries([
  "first", "cooldown", "raceSame", "raceDifferent", "confirmed", "started",
  "noRecipient", "inactive", "foreign", "bulkEligible", "rollback",
].map((name, index) => [name, {
  shift: `${prefix}-0001-${String(index + 1).padStart(12, "0")}`,
  assignment: `${prefix}-0002-${String(index + 1).padStart(12, "0")}`,
}]));

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

function result(sql) {
  return JSON.parse(run(sql).split(/\r?\n/).at(-1));
}

function send(actor, assignmentId, key) {
  return result(roleSql(actor, `select public.send_pre_confirmation_reminder('${assignmentId}'::uuid,'${key}'::uuid)::text;`));
}

function bulk(actor, assignmentIds, key) {
  const values = assignmentIds.map((id) => `'${id}'::uuid`).join(",");
  return result(roleSql(actor, `select public.send_pre_confirmation_reminders(array[${values}],'${key}'::uuid)::text;`));
}

function concurrent(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)))
      : reject(new Error(stderr || stdout)));
    child.stdin.end(sql);
  });
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
update private.pre_confirmation_reminder_occurrences
set outcome='not_eligible', notification_id=null
where assignment_id::text like '${prefix}-0002-%';
delete from public.in_app_notifications where source_pre_confirmation_reminder_id in (
  select id from private.pre_confirmation_reminder_occurrences where assignment_id::text like '${prefix}-0002-%'
);
delete from private.pre_confirmation_reminder_occurrences where assignment_id::text like '${prefix}-0002-%';
delete from private.pre_confirmation_reminder_commands where request_fingerprint like '%${prefix}-0002-%';
delete from public.pre_shift_confirmations where assignment_id::text like '${prefix}-0002-%';
delete from public.assignments where id::text like '${prefix}-0002-%';
delete from public.shift_slots where id::text like '${prefix}-0001-%';
delete from public.workers where id='${workers.noRecipient}';
drop trigger if exists fail_notif_2b_projection on public.in_app_notifications;
drop function if exists private.fail_notif_2b_projection();
commit;`);
}

try {
  cleanup();
  run(`begin;
insert into public.workers (id,staff_code,branch_id,auth_profile_id,display_name,status)
values ('${workers.noRecipient}','NOTIF2B-NO-RECIPIENT','b0000000-0000-0000-0000-000000000001',null,'NOTIF 2B no recipient','active');
insert into public.shift_slots (id,job_id,label,starts_at,ends_at,required_workers,status) values
('${ids.first.shift}','${jobs.own}','NOTIF2B first',now()+interval '2 hours',now()+interval '10 hours',1,'confirmed'),
('${ids.cooldown.shift}','${jobs.own}','NOTIF2B cooldown',now()+interval '3 hours',now()+interval '11 hours',1,'confirmed'),
('${ids.raceSame.shift}','${jobs.own}','NOTIF2B race same',now()+interval '4 hours',now()+interval '12 hours',1,'confirmed'),
('${ids.raceDifferent.shift}','${jobs.own}','NOTIF2B race different',now()+interval '5 hours',now()+interval '13 hours',1,'confirmed'),
('${ids.confirmed.shift}','${jobs.own}','NOTIF2B confirmed',now()+interval '6 hours',now()+interval '14 hours',1,'confirmed'),
('${ids.started.shift}','${jobs.own}','NOTIF2B started',now()-interval '1 hour',now()+interval '7 hours',1,'confirmed'),
('${ids.noRecipient.shift}','${jobs.own}','NOTIF2B no recipient',now()+interval '7 hours',now()+interval '15 hours',1,'confirmed'),
('${ids.inactive.shift}','${jobs.own}','NOTIF2B inactive',now()+interval '8 hours',now()+interval '16 hours',1,'confirmed'),
('${ids.foreign.shift}','${jobs.foreign}','NOTIF2B foreign',now()+interval '9 hours',now()+interval '17 hours',1,'confirmed'),
('${ids.bulkEligible.shift}','${jobs.own}','NOTIF2B bulk eligible',now()+interval '10 hours',now()+interval '18 hours',1,'confirmed'),
('${ids.rollback.shift}','${jobs.own}','NOTIF2B rollback',now()+interval '11 hours',now()+interval '19 hours',1,'confirmed');
insert into public.assignments (id,shift_slot_id,worker_id,source,status) values
('${ids.first.assignment}','${ids.first.shift}','${workers.a}','manager','assigned'),
('${ids.cooldown.assignment}','${ids.cooldown.shift}','${workers.a}','manager','assigned'),
('${ids.raceSame.assignment}','${ids.raceSame.shift}','${workers.a}','manager','assigned'),
('${ids.raceDifferent.assignment}','${ids.raceDifferent.shift}','${workers.a}','manager','assigned'),
('${ids.confirmed.assignment}','${ids.confirmed.shift}','${workers.a}','manager','assigned'),
('${ids.started.assignment}','${ids.started.shift}','${workers.a}','manager','assigned'),
('${ids.noRecipient.assignment}','${ids.noRecipient.shift}','${workers.noRecipient}','manager','assigned'),
('${ids.inactive.assignment}','${ids.inactive.shift}','${workers.b}','manager','assigned'),
('${ids.foreign.assignment}','${ids.foreign.shift}','${workers.foreign}','manager','assigned'),
('${ids.bulkEligible.assignment}','${ids.bulkEligible.shift}','${workers.a}','manager','assigned'),
('${ids.rollback.assignment}','${ids.rollback.shift}','${workers.a}','manager','assigned');
insert into public.pre_shift_confirmations (assignment_id,can_work,health_status)
values ('${ids.confirmed.assignment}',true,'good');
commit;`);

  pass("private reminder tables have RLS", run(`select bool_and(c.relrowsecurity)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('pre_confirmation_reminder_commands','pre_confirmation_reminder_occurrences');`) === "true");
  pass("private reminder tables have no runtime Data API grants", run(`select bool_and(not has_table_privilege(r,format('%I.%I',n.nspname,c.relname),p))::text from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['public','anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p where n.nspname='private' and c.relname in ('pre_confirmation_reminder_commands','pre_confirmation_reminder_occurrences');`) === "true");
  pass("only the four controlled notification types are valid", run(`select pg_get_constraintdef(oid) like '%pre_confirmation_reminder%' from pg_constraint where conname='in_app_notifications_type_check';`) === "t");

  const firstKey = "99000000-0000-0000-1000-000000000001";
  const first = send(actors.manager, ids.first.assignment, firstKey);
  pass("first eligible reminder projects one controlled notification", first.ok && first.status === "complete" && first.counts.projected === 1 && !first.replayed);
  const firstNotification = first.items[0].notification_id;
  pass("projection snapshot and immutable occurrence source are exact", run(`select (n.notification_type='pre_confirmation_reminder' and n.title='勤務前確認の回答をお願いします' and n.summary='勤務前確認が未回答です。勤務詳細から回答してください。' and o.assignment_id='${ids.first.assignment}' and o.notification_id=n.id)::text from public.in_app_notifications n join private.pre_confirmation_reminder_occurrences o on o.id=n.source_pre_confirmation_reminder_id where n.id='${firstNotification}';`) === "true");
  const replay = send(actors.manager, ids.first.assignment, firstKey);
  pass("same actor key and fingerprint replays without duplicate", replay.ok && replay.replayed && replay.command_id === first.command_id && replay.items[0].notification_id === firstNotification && run(`select count(*)::text from public.in_app_notifications where id='${firstNotification}';`) === "1");
  const conflict = send(actors.manager, ids.cooldown.assignment, firstKey);
  pass("same key with a different fingerprint conflicts without writes", !conflict.ok && conflict.code === "IDEMPOTENCY_CONFLICT");

  const cooldownFirst = send(actors.manager, ids.cooldown.assignment, "99000000-0000-0000-1000-000000000002");
  const insideCooldown = send(actors.manager, ids.cooldown.assignment, "99000000-0000-0000-1000-000000000003");
  pass("fresh key inside cooldown is rate limited", cooldownFirst.items[0].outcome === "projected" && insideCooldown.items[0].outcome === "rate_limited" && insideCooldown.counts.projected === 0);
  run(`update private.pre_confirmation_reminder_occurrences set requested_at=now()-interval '16 minutes' where notification_id='${cooldownFirst.items[0].notification_id}';`);
  const afterCooldown = send(actors.manager, ids.cooldown.assignment, "99000000-0000-0000-1000-000000000004");
  pass("intentional later re-notify after cooldown creates a new occurrence", afterCooldown.items[0].outcome === "projected" && afterCooldown.items[0].notification_id !== cooldownFirst.items[0].notification_id);

  const sameRaceSql = roleSql(actors.manager, `select public.send_pre_confirmation_reminder('${ids.raceSame.assignment}'::uuid,'99000000-0000-0000-1000-000000000005'::uuid)::text;`);
  const [sameA, sameB] = await Promise.all([concurrent(sameRaceSql), concurrent(sameRaceSql)]);
  pass("concurrent same key converges to one command and notification", sameA.command_id === sameB.command_id && [sameA, sameB].filter((item) => item.replayed).length === 1 && run(`select count(*)::text from public.in_app_notifications n join private.pre_confirmation_reminder_occurrences o on o.id=n.source_pre_confirmation_reminder_id where o.assignment_id='${ids.raceSame.assignment}';`) === "1");
  const raceSqlA = roleSql(actors.manager, `select public.send_pre_confirmation_reminder('${ids.raceDifferent.assignment}'::uuid,'99000000-0000-0000-1000-000000000006'::uuid)::text;`);
  const raceSqlB = roleSql(actors.manager, `select public.send_pre_confirmation_reminder('${ids.raceDifferent.assignment}'::uuid,'99000000-0000-0000-1000-000000000007'::uuid)::text;`);
  const different = await Promise.all([concurrent(raceSqlA), concurrent(raceSqlB)]);
  pass("concurrent different keys serialize to projected and rate limited", different.map((item) => item.items[0].outcome).sort().join(",") === "projected,rate_limited");

  pass("missing linked profile returns no recipient", send(actors.manager, ids.noRecipient.assignment, "99000000-0000-0000-1000-000000000008").items[0].outcome === "no_recipient");
  const inactiveOutput = run(`begin; update public.workers set status='inactive' where id='${workers.b}'; set local role authenticated; set local request.jwt.claims='{"sub":"${actors.manager}","role":"authenticated"}'; select public.send_pre_confirmation_reminder('${ids.inactive.assignment}'::uuid,'99000000-0000-0000-1000-000000000009'::uuid)::text; reset role; update public.workers set status='active' where id='${workers.b}'; commit;`).split(/\r?\n/).find((line) => line.startsWith("{"));
  pass("inactive linked Worker returns inactive recipient", JSON.parse(inactiveOutput).items[0].outcome === "inactive_recipient");
  pass("submitted confirmation is no longer eligible", send(actors.manager, ids.confirmed.assignment, "99000000-0000-0000-1000-000000000010").items[0].outcome === "not_eligible");
  pass("started Shift is no longer eligible", send(actors.manager, ids.started.assignment, "99000000-0000-0000-1000-000000000011").items[0].outcome === "not_eligible");
  pass("Manager foreign Branch is non-disclosing unavailable", send(actors.manager, ids.foreign.assignment, "99000000-0000-0000-1000-000000000012").items[0].outcome === "unavailable");
  pass("System Admin may project across Branches", send(actors.admin, ids.foreign.assignment, "99000000-0000-0000-1000-000000000013").items[0].outcome === "projected");

  const missingId = "99000000-0000-0000-0002-999999999999";
  const mixed = bulk(actors.manager, [ids.bulkEligible.assignment, ids.confirmed.assignment, ids.noRecipient.assignment, missingId], "99000000-0000-0000-1000-000000000014");
  pass("bounded bulk commits exact mixed per-target outcomes", mixed.ok && mixed.status === "partial" && mixed.counts.requested === 4 && mixed.counts.projected === 1 && mixed.items.map((item) => item.outcome).sort().join(",") === "no_recipient,not_eligible,projected,unavailable");
  const tooMany = Array.from({ length: 51 }, (_, index) => `${prefix}-0002-${String(1000 + index).padStart(12, "0")}`);
  pass("bulk rejects more than 50 distinct targets", bulk(actors.manager, tooMany, "99000000-0000-0000-1000-000000000015").code === "INVALID_INPUT");

  run(`create function private.fail_notif_2b_projection() returns trigger language plpgsql set search_path='' as $$ begin if new.source_pre_confirmation_reminder_id in (select o.id from private.pre_confirmation_reminder_occurrences o where o.assignment_id='${ids.rollback.assignment}') then raise exception 'NOTIF2B forced failure'; end if; return new; end; $$; create trigger fail_notif_2b_projection before insert on public.in_app_notifications for each row execute function private.fail_notif_2b_projection();`);
  const rollbackFailure = run(roleSql(actors.manager, `select public.send_pre_confirmation_reminder('${ids.rollback.assignment}'::uuid,'99000000-0000-0000-1000-000000000016'::uuid)::text;`), { allowFailure: true });
  run(`drop trigger fail_notif_2b_projection on public.in_app_notifications; drop function private.fail_notif_2b_projection();`);
  pass("unexpected database failure rolls back command occurrence and notification", rollbackFailure.includes("NOTIF2B forced failure") && run(`select ((select count(*) from private.pre_confirmation_reminder_occurrences where assignment_id='${ids.rollback.assignment}')=0 and (select count(*) from private.pre_confirmation_reminder_commands where idempotency_key='99000000-0000-0000-1000-000000000016')=0)::text;`) === "true");

  const ownResolved = result(roleSql(actors.workerA, `select public.resolve_pre_confirmation_reminder_source_context('${firstNotification}'::uuid)::text;`));
  pass("own Worker resolver exposes only source availability and Assignment", ownResolved.ok && ownResolved.source_available && ownResolved.assignment_id === ids.first.assignment && Object.keys(ownResolved).sort().join(",") === "assignment_id,ok,source_available");
  const foreignResolved = result(roleSql(actors.workerB, `select public.resolve_pre_confirmation_reminder_source_context('${firstNotification}'::uuid)::text;`));
  pass("foreign Worker resolver returns safe unavailable", foreignResolved.ok && !foreignResolved.source_available && foreignResolved.assignment_id === null);
  const announcementNotification = run(`select id::text from public.in_app_notifications where notification_type='announcement_published' limit 1;`);
  if (announcementNotification) {
    const wrongType = result(roleSql(actors.workerA, `select public.resolve_pre_confirmation_reminder_source_context('${announcementNotification}'::uuid)::text;`));
    pass("wrong notification type resolves to the same safe unavailable shape", wrongType.ok && !wrongType.source_available && wrongType.assignment_id === null);
  }

  const read = result(roleSql(actors.workerA, `select public.mark_in_app_notification_read('${firstNotification}'::uuid)::text;`));
  pass("existing mark-read changes Notification without resolving source condition", read.ok && run(`select ((select read_at is not null from public.in_app_notifications where id='${firstNotification}') and not exists (select 1 from public.pre_shift_confirmations where assignment_id='${ids.first.assignment}'))::text;`) === "true");
  run(`insert into public.pre_shift_confirmations (assignment_id,can_work,health_status) values ('${ids.first.assignment}',true,'good');`);
  const resolvedAfterConfirmation = result(roleSql(actors.workerA, `select public.resolve_pre_confirmation_reminder_source_context('${firstNotification}'::uuid)::text;`));
  pass("submitted confirmation resolves the source condition but preserves Notification history and navigation", resolvedAfterConfirmation.ok && resolvedAfterConfirmation.source_available && resolvedAfterConfirmation.assignment_id === ids.first.assignment && run(`select ((select count(*) from public.in_app_notifications where id='${firstNotification}')=1 and exists (select 1 from public.pre_shift_confirmations where assignment_id='${ids.first.assignment}'))::text;`) === "true");
  pass("Worker RLS still isolates another recipient notification", run(roleSql(actors.workerB, `select count(*)::text from public.in_app_notifications where id='${firstNotification}';`)).endsWith("0"));
  pass("runtime roles cannot directly execute private core or write reminder state", run(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['public','anon','authenticated','service_role']) r where n.nspname='private' and p.proname in ('send_pre_confirmation_reminders_core','pre_confirmation_reminder_command_result');`) === "true");
  pass("PUBLIC anon and service role cannot execute public reminder RPCs", run(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['public','anon','service_role']) r where n.nspname='public' and p.proname in ('send_pre_confirmation_reminder','send_pre_confirmation_reminders','resolve_pre_confirmation_reminder_source_context');`) === "true");

  console.log(`PASS ${passed} pre-confirmation reminder projection assertions`);
} finally {
  cleanup();
}
