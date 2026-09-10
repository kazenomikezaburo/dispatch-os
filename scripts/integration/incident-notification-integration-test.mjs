import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const actors = {
  worker: "a0000000-0000-0000-0000-000000000001",
  foreignWorker: "a0000000-0000-0000-0000-000000000002",
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const workerId = "c0000000-0000-0000-0000-000000000001";
const jobId = "10000000-0000-0000-0000-000000000001";
const ids = {
  shift: "98100000-0000-0000-0001-000000000001",
  assignment: "98100000-0000-0000-0002-000000000001",
};

function run(sql) {
  return execFileSync("docker", dockerArgs, { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function roleSql(profileId, body) {
  return `begin; set local role authenticated; set local request.jwt.claims='{"sub":"${profileId}","role":"authenticated"}'; ${body} commit;`;
}

function result(sql) {
  return JSON.parse(run(sql).split(/\r?\n/).at(-1));
}

function transitionAndProject(command, actor, incidentId, version, key) {
  const transition = result(roleSql(actor, `select public.${command}_operational_incident('${incidentId}'::uuid,${version},'${key}')::text;`));
  assert.equal(transition.ok, true);
  const projection = result(roleSql(actor, `select public.project_incident_in_app_notification('${transition.event_id}'::uuid)::text;`));
  return { transition, projection };
}

function reconcile(actor, expectedEventIds) {
  const discovered = run("select source_event_id::text from private.list_unprojected_incident_notification_events(null,null,100);").split(/\r?\n/).filter(Boolean);
  const targets = discovered.filter((eventId) => expectedEventIds.includes(eventId));
  return targets.map((eventId) => result(roleSql(actor, `select public.project_incident_in_app_notification('${eventId}'::uuid)::text;`)));
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
delete from private.incident_notification_projection_receipts where source_incident_event_id in (select e.id from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id='${ids.assignment}');
delete from public.in_app_notifications where source_incident_event_id in (select e.id from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id='${ids.assignment}');
delete from public.operational_incident_events where incident_id in (select id from public.operational_incidents where assignment_id='${ids.assignment}');
delete from public.operational_incidents where assignment_id='${ids.assignment}';
delete from public.assignments where id='${ids.assignment}';
delete from public.shift_slots where id='${ids.shift}';
commit;`);
}

try {
  cleanup();
  run(`begin;
insert into public.shift_slots(id,job_id,starts_at,ends_at,required_workers,status) values('${ids.shift}','${jobId}',now()+interval '60 days',now()+interval '60 days 8 hours',1,'confirmed');
insert into public.assignments(id,shift_slot_id,worker_id,source,status) values('${ids.assignment}','${ids.shift}','${workerId}','manager','assigned');
commit;`);

  const created = result(roleSql(actors.worker, `select public.create_operational_incident('${ids.assignment}'::uuid,'other','integration fixture','int-2.8e-create')::text;`));
  const ack = transitionAndProject("acknowledge", actors.manager, created.incident_id, 1, "int-2.8e-ack");
  pass("acknowledged production sequence projects one recipient notification", ack.projection.ok && run(`select (count(*)=1 and bool_and(recipient_profile_id='${actors.worker}' and notification_type='incident_acknowledged'))::text from public.in_app_notifications where source_incident_event_id='${ack.transition.event_id}';`) === "true");
  const ackRetry = transitionAndProject("acknowledge", actors.manager, created.incident_id, 1, "int-2.8e-ack");
  pass("acknowledge command retry reuses event and notification", ackRetry.transition.replayed && ackRetry.transition.event_id === ack.transition.event_id && ackRetry.projection.replayed && ackRetry.projection.notification_id === ack.projection.notification_id);
  pass("acknowledge retry leaves one event and one notification", run(`select ((select count(*) from public.operational_incident_events where incident_id='${created.incident_id}' and event_type='acknowledged')=1 and (select count(*) from public.in_app_notifications where source_incident_event_id='${ack.transition.event_id}')=1)::text;`) === "true");

  const read = result(roleSql(actors.worker, `select public.mark_in_app_notification_read('${ack.projection.notification_id}'::uuid)::text;`));
  const resolved = transitionAndProject("resolve", actors.admin, created.incident_id, 2, "int-2.8e-resolve");
  pass("resolved production sequence adds a distinct second notification", resolved.projection.ok && resolved.transition.event_id !== ack.transition.event_id && run(`select count(*)::text from public.in_app_notifications where source_incident_event_id in ('${ack.transition.event_id}','${resolved.transition.event_id}');`) === "2");
  const resolveRetry = transitionAndProject("resolve", actors.admin, created.incident_id, 2, "int-2.8e-resolve");
  pass("resolve command retry reuses event and notification", resolveRetry.transition.replayed && resolveRetry.transition.event_id === resolved.transition.event_id && resolveRetry.projection.replayed && resolveRetry.projection.notification_id === resolved.projection.notification_id);
  pass("projection replay preserves the original read state", result(roleSql(actors.manager, `select public.project_incident_in_app_notification('${ack.transition.event_id}'::uuid)::text;`)).replayed && run(`select (read_at='${read.read_at}'::timestamptz)::text from public.in_app_notifications where id='${ack.projection.notification_id}';`) === "true");

  run(`delete from public.in_app_notifications where id in ('${ack.projection.notification_id}','${resolved.projection.notification_id}');`);
  pass("deleted derived rows become missing acknowledged and resolved projections", run(`select count(*)::text from private.list_unprojected_incident_notification_events(null,null,100) where source_event_id in ('${ack.transition.event_id}','${resolved.transition.event_id}');`) === "2");
  const recovered = reconcile(actors.admin, [ack.transition.event_id, resolved.transition.event_id]);
  pass("reconciliation recovers both missing event projections", recovered.length === 2 && recovered.every((item) => item.ok && item.outcome === "projected") && run(`select count(*)::text from public.in_app_notifications where source_incident_event_id in ('${ack.transition.event_id}','${resolved.transition.event_id}');`) === "2");
  const recoveredRows = JSON.parse(run(`select json_agg(row_to_json(x) order by notification_type)::text from (select id,notification_type,recipient_profile_id,read_at from public.in_app_notifications where source_incident_event_id in ('${ack.transition.event_id}','${resolved.transition.event_id}')) x;`));
  pass("recovered notifications retain canonical recipient and start unread", recoveredRows.every((item) => item.recipient_profile_id === actors.worker && item.read_at === null));
  const recoveredAck = recoveredRows.find((item) => item.notification_type === "incident_acknowledged");
  const recoveredResolved = recoveredRows.find((item) => item.notification_type === "incident_resolved");
  const recoveredRead = result(roleSql(actors.worker, `select public.mark_in_app_notification_read('${recoveredAck.id}'::uuid)::text;`));
  pass("reconciliation rerun creates nothing and preserves read_at", reconcile(actors.admin, [ack.transition.event_id, resolved.transition.event_id]).length === 0 && run(`select (count(*)=2 and bool_and(case when id='${recoveredAck.id}' then read_at='${recoveredRead.read_at}'::timestamptz else read_at is null end))::text from public.in_app_notifications where source_incident_event_id in ('${ack.transition.event_id}','${resolved.transition.event_id}');`) === "true");

  for (const notification of [recoveredAck, recoveredResolved]) {
    const own = result(roleSql(actors.worker, `select public.resolve_in_app_notification_source_context('${notification.id}'::uuid)::text;`));
    const foreign = result(roleSql(actors.foreignWorker, `select public.resolve_in_app_notification_source_context('${notification.id}'::uuid)::text;`));
    pass(`${notification.notification_type} resolver preserves current Assignment authorization`, own.ok && own.source_available && own.assignment_id === ids.assignment && foreign.ok && !foreign.source_available && foreign.assignment_id === null);
  }
  pass("foreign Worker cannot read projected or recovered notifications", run(roleSql(actors.foreignWorker, `select count(*)::text from public.in_app_notifications where source_incident_event_id in ('${ack.transition.event_id}','${resolved.transition.event_id}');`)).endsWith("0"));
  pass("Worker remains isolated from canonical Incident Events", run(roleSql(actors.worker, `select count(*)::text from public.operational_incident_events where incident_id='${created.incident_id}';`)).endsWith("0"));
  pass("recovery leaves canonical Incident state and event history unchanged", run(`select ((select state='resolved' and version=3 from public.operational_incidents where id='${created.incident_id}') and (select count(*)=3 from public.operational_incident_events where incident_id='${created.incident_id}'))::text;`) === "true");
} finally {
  cleanup();
}

pass("integration fixtures are fully cleaned up", run(`select ((select count(*) from public.shift_slots where id='${ids.shift}')+(select count(*) from public.assignments where id='${ids.assignment}')+(select count(*) from public.operational_incidents where assignment_id='${ids.assignment}'))::text;`) === "0");
console.log(`Incident Notification Integration: ${passed}/${passed} passed`);
