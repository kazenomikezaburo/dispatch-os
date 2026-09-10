import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const dockerArgs = ['exec', '-i', 'supabase_db_dispatch-os', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'];
const actors = {
  workerA: 'a0000000-0000-0000-0000-000000000001',
  workerB: 'a0000000-0000-0000-0000-000000000002',
  manager: 'a0000000-0000-0000-0000-000000000004',
  admin: 'a0000000-0000-0000-0000-000000000005',
};
const workers = {
  workerA: 'c0000000-0000-0000-0000-000000000001',
  workerB: 'c0000000-0000-0000-0000-000000000002',
};
const ids = {
  shift: '99000000-0000-0000-0001-000000000001',
  assignment: '99000000-0000-0000-0002-000000000001',
  mismatchedNotification: '99000000-0000-0000-0003-000000000001',
};
const jobId = '10000000-0000-0000-0000-000000000001';

function run(sql, { allowFailure = false } = {}) {
  try {
    return execFileSync('docker', dockerArgs, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFailure) return `${error.stdout ?? ''}${error.stderr ?? ''}`;
    throw error;
  }
}

function roleSql(profileId, body, role = 'authenticated') {
  const claims = profileId ? `{"sub":"${profileId}","role":"${role}"}` : `{"role":"${role}"}`;
  return `begin; set local role ${role}; set local request.jwt.claims='${claims}'; ${body} commit;`;
}

function result(sql) {
  return JSON.parse(run(sql).split(/\r?\n/).at(-1));
}

function resolve(profileId, notificationId) {
  return result(roleSql(profileId, `select public.resolve_in_app_notification_source_context('${notificationId}'::uuid)::text;`));
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
delete from private.incident_notification_projection_receipts where source_incident_event_id in (
  select e.id from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id='${ids.assignment}'
);
delete from public.in_app_notifications where source_incident_event_id in (
  select e.id from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id='${ids.assignment}'
);
delete from public.operational_incident_events where incident_id in (select id from public.operational_incidents where assignment_id='${ids.assignment}');
delete from public.operational_incidents where assignment_id='${ids.assignment}';
delete from public.assignments where id='${ids.assignment}';
delete from public.shift_slots where id='${ids.shift}';
commit;`);
}

try {
  cleanup();
  run(`begin;
insert into public.shift_slots(id,job_id,starts_at,ends_at,required_workers,status)
values('${ids.shift}','${jobId}',now()+interval '50 days',now()+interval '50 days 8 hours',1,'confirmed');
insert into public.assignments(id,shift_slot_id,worker_id,source,status)
values('${ids.assignment}','${ids.shift}','${workers.workerA}','manager','assigned');
commit;`);

  const created = result(roleSql(actors.workerA, `select public.create_operational_incident('${ids.assignment}'::uuid,'other','resolver privacy text','resolver-create')::text;`));
  const acknowledged = result(roleSql(actors.manager, `select public.acknowledge_operational_incident('${created.incident_id}'::uuid,1,'resolver-ack')::text;`));
  const projected = result(roleSql(actors.manager, `select public.project_incident_in_app_notification('${acknowledged.event_id}'::uuid)::text;`));
  pass('fixture notification is projected through canonical lifecycle', created.ok && acknowledged.ok && projected.ok && projected.outcome === 'projected');

  const own = resolve(actors.workerA, projected.notification_id);
  pass('own notification resolves to its currently owned Assignment', own.ok && own.source_available && own.assignment_id === ids.assignment);
  pass('success result contains only minimal safe fields', Object.keys(own).sort().join(',') === 'assignment_id,ok,source_available');
  pass('success result exposes no Incident internal identifiers or payload', !JSON.stringify(own).match(/incident|event|message|category|actor|metadata/i));

  const foreign = resolve(actors.workerB, projected.notification_id);
  const nonexistent = resolve(actors.workerB, 'ffffffff-ffff-ffff-ffff-ffffffffffff');
  pass('foreign Worker receives safe unresolved result', foreign.ok && !foreign.source_available && foreign.assignment_id === null);
  pass('foreign and nonexistent notifications are indistinguishable', JSON.stringify(foreign) === JSON.stringify(nonexistent));

  const manager = resolve(actors.manager, projected.notification_id);
  const admin = resolve(actors.admin, projected.notification_id);
  pass('Manager cannot use Worker source resolver', !manager.ok && manager.code === 'NOT_FOUND');
  pass('System Admin cannot use Worker source resolver', !admin.ok && admin.code === 'NOT_FOUND');
  pass('null input follows stable invalid-input contract', result(roleSql(actors.workerA, `select public.resolve_in_app_notification_source_context(null)::text;`)).code === 'INVALID_INPUT');

  const unauthorized = result(`begin; update public.assignments set worker_id='${workers.workerB}' where id='${ids.assignment}'; set local role authenticated; set local request.jwt.claims='{"sub":"${actors.workerA}","role":"authenticated"}'; select public.resolve_in_app_notification_source_context('${projected.notification_id}'::uuid)::text; rollback;`);
  pass('recipient ownership alone cannot bypass current Assignment ownership', unauthorized.ok && !unauthorized.source_available && unauthorized.assignment_id === null);

  run(`insert into public.in_app_notifications(id,recipient_profile_id,notification_type,source_incident_event_id,title,summary) values('${ids.mismatchedNotification}','${actors.workerA}','incident_acknowledged','${created.event_id}','Mismatch fixture','Mismatch fixture');`);
  const mismatched = resolve(actors.workerA, ids.mismatchedNotification);
  pass('unsupported event/type relation resolves safely without internal detail', mismatched.ok && !mismatched.source_available && mismatched.assignment_id === null);

  const before = run(`select json_build_object('notifications',(select count(*) from public.in_app_notifications where source_incident_event_id='${acknowledged.event_id}'),'receipts',(select count(*) from private.incident_notification_projection_receipts where source_incident_event_id='${acknowledged.event_id}'),'read_at',(select read_at from public.in_app_notifications where id='${projected.notification_id}'))::text;`);
  resolve(actors.workerA, projected.notification_id);
  const after = run(`select json_build_object('notifications',(select count(*) from public.in_app_notifications where source_incident_event_id='${acknowledged.event_id}'),'receipts',(select count(*) from private.incident_notification_projection_receipts where source_incident_event_id='${acknowledged.event_id}'),'read_at',(select read_at from public.in_app_notifications where id='${projected.notification_id}'))::text;`);
  pass('resolver is read-only and does not mark Notification read', before === after);

  pass('PUBLIC and anon cannot execute resolver while authenticated can', run(`select (not has_function_privilege('public','public.resolve_in_app_notification_source_context(uuid)','EXECUTE') and not has_function_privilege('anon','public.resolve_in_app_notification_source_context(uuid)','EXECUTE') and has_function_privilege('authenticated','public.resolve_in_app_notification_source_context(uuid)','EXECUTE'))::text;`) === 'true');
  pass('anon direct execution is denied at privilege boundary', run(roleSql(null, `select public.resolve_in_app_notification_source_context('${projected.notification_id}'::uuid);`, 'anon'), { allowFailure: true }).includes('permission denied'));
  pass('resolver is hardened and has the exact one-UUID signature', run(`select (p.prosecdef and p.provolatile='s' and p.proconfig[1]='search_path=""' and pg_get_userbyid(p.proowner)='postgres' and pg_get_function_identity_arguments(p.oid)='p_notification_id uuid' and pg_get_function_result(p.oid)='jsonb')::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_in_app_notification_source_context';`) === 'true');
  pass('Worker still cannot read Incident Event rows directly', run(roleSql(actors.workerA, `select count(*)::text from public.operational_incident_events where id='${acknowledged.event_id}';`)).endsWith('0'));
  pass('no Worker Incident Event SELECT policy was added', run(`select count(*)::text from pg_policies where schemaname='public' and tablename='operational_incident_events' and roles::text like '%authenticated%' and policyname ilike '%worker%';`) === '0');
} finally {
  cleanup();
}

pass('resolver fixtures are fully cleaned up', run(`select ((select count(*) from public.assignments where id='${ids.assignment}')+(select count(*) from public.shift_slots where id='${ids.shift}')+(select count(*) from public.in_app_notifications where id='${ids.mismatchedNotification}'))::text;`) === '0');
console.log(`Notification Source Context: ${passed}/${passed} passed`);
