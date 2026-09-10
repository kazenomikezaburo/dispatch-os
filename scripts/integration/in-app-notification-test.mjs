import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';

const dockerArgs = ['exec', '-i', 'supabase_db_dispatch-os', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'];
const actors = {
  worker: 'a0000000-0000-0000-0000-000000000001',
  foreignWorker: 'a0000000-0000-0000-0000-000000000002',
  manager: 'a0000000-0000-0000-0000-000000000004',
  admin: 'a0000000-0000-0000-0000-000000000005',
};
const workerId = 'c0000000-0000-0000-0000-000000000001';
const jobId = '10000000-0000-0000-0000-000000000001';
const ids = {
  ackShift: '98000000-0000-0000-0001-000000000001',
  ackAssignment: '98000000-0000-0000-0002-000000000001',
  resolveShift: '98000000-0000-0000-0001-000000000002',
  resolveAssignment: '98000000-0000-0000-0002-000000000002',
  raceShift: '98000000-0000-0000-0001-000000000003',
  raceAssignment: '98000000-0000-0000-0002-000000000003',
  inactiveShift: '98000000-0000-0000-0001-000000000004',
  inactiveAssignment: '98000000-0000-0000-0002-000000000004',
  retractShift: '98000000-0000-0000-0001-000000000005',
  retractAssignment: '98000000-0000-0000-0002-000000000005',
};

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
  return `begin; set local role ${role}; set local request.jwt.claims = '${claims}'; ${body} commit;`;
}

function result(sql) {
  return JSON.parse(run(sql).split(/\r?\n/).at(-1));
}

function createIncident(assignmentId, key) {
  return result(roleSql(actors.worker, `select public.create_operational_incident('${assignmentId}'::uuid, 'other', null, '${key}')::text;`));
}

function transition(command, actor, incidentId, version, key) {
  return result(roleSql(actor, `select public.${command}_operational_incident('${incidentId}'::uuid, ${version}, '${key}')::text;`));
}

function project(actor, eventId) {
  return result(roleSql(actor, `select public.project_incident_in_app_notification('${eventId}'::uuid)::text;`));
}

function concurrent(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1))) : reject(new Error(stderr || stdout)));
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
delete from private.incident_notification_projection_receipts where source_incident_event_id in (
  select e.id from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id::text like '98000000-0000-0000-0002-%'
);
delete from public.in_app_notifications where source_incident_event_id in (
  select e.id from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id::text like '98000000-0000-0000-0002-%'
);
delete from public.operational_incident_events where incident_id in (select id from public.operational_incidents where assignment_id::text like '98000000-0000-0000-0002-%');
delete from public.operational_incidents where assignment_id::text like '98000000-0000-0000-0002-%';
delete from public.assignments where id::text like '98000000-0000-0000-0002-%';
delete from public.shift_slots where id::text like '98000000-0000-0000-0001-%';
commit;`);
}

try {
  cleanup();
  run(`begin;
insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status) values
('${ids.ackShift}', '${jobId}', now()+interval '40 days', now()+interval '40 days 8 hours', 1, 'confirmed'),
('${ids.resolveShift}', '${jobId}', now()+interval '41 days', now()+interval '41 days 8 hours', 1, 'confirmed'),
('${ids.raceShift}', '${jobId}', now()+interval '42 days', now()+interval '42 days 8 hours', 1, 'confirmed'),
('${ids.inactiveShift}', '${jobId}', now()+interval '43 days', now()+interval '43 days 8 hours', 1, 'confirmed'),
('${ids.retractShift}', '${jobId}', now()+interval '44 days', now()+interval '44 days 8 hours', 1, 'confirmed');
insert into public.assignments (id, shift_slot_id, worker_id, source, status) values
('${ids.ackAssignment}', '${ids.ackShift}', '${workerId}', 'manager', 'assigned'),
('${ids.resolveAssignment}', '${ids.resolveShift}', '${workerId}', 'manager', 'assigned'),
('${ids.raceAssignment}', '${ids.raceShift}', '${workerId}', 'manager', 'assigned'),
('${ids.inactiveAssignment}', '${ids.inactiveShift}', '${workerId}', 'manager', 'assigned'),
('${ids.retractAssignment}', '${ids.retractShift}', '${workerId}', 'manager', 'assigned');
commit;`);

  pass('notification and receipt tables have RLS enabled', run(`select bool_and(relrowsecurity)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname) in (('public','in_app_notifications'),('private','incident_notification_projection_receipts'),('private','incident_notification_projection_state'));`) === 'true');
  pass('notification types remain a closed three-value set', run(`select pg_get_constraintdef(oid) from pg_constraint where conname='in_app_notifications_type_check';`) === "CHECK ((notification_type = ANY (ARRAY['incident_acknowledged'::text, 'incident_resolved'::text, 'announcement_published'::text])))");

  const created = createIncident(ids.ackAssignment, 'notification-create-ack');
  pass('source incident is created without notification side effect', created.ok && run(`select count(*)::text from public.in_app_notifications where source_incident_event_id='${created.event_id}';`) === '0');
  const notApplicable = project(actors.manager, created.event_id);
  pass('created source event is explicitly not applicable', !notApplicable.ok && notApplicable.code === 'NOT_APPLICABLE');
  pass('not-applicable event does not consume a receipt', run(`select count(*)::text from private.incident_notification_projection_receipts where source_incident_event_id='${created.event_id}';`) === '0');

  const acknowledged = transition('acknowledge', actors.manager, created.incident_id, 1, 'notification-ack');
  const ackProjection = project(actors.manager, acknowledged.event_id);
  pass('branch Manager projects acknowledged event', ackProjection.ok && ackProjection.outcome === 'projected' && !ackProjection.replayed);
  const ackRow = JSON.parse(run(`select row_to_json(x)::text from (select recipient_profile_id,notification_type,title,summary,(read_at is null) unread from public.in_app_notifications where id='${ackProjection.notification_id}') x;`));
  pass('acknowledged projection stores controlled recipient-owned copy', ackRow.recipient_profile_id === actors.worker && ackRow.notification_type === 'incident_acknowledged' && ackRow.title === 'Help Requestへの対応が開始されました' && ackRow.summary === '管理者がHelp Requestを確認し、対応を開始しました。' && ackRow.unread);
  pass('projected receipt and notification are linked atomically', run(`select (r.outcome='projected' and r.notification_id=n.id and r.recipient_profile_id=n.recipient_profile_id)::text from private.incident_notification_projection_receipts r join public.in_app_notifications n on n.id=r.notification_id where r.source_incident_event_id='${acknowledged.event_id}';`) === 'true');
  const ackReplay = project(actors.manager, acknowledged.event_id);
  pass('projection replay returns the original notification', ackReplay.ok && ackReplay.replayed && ackReplay.notification_id === ackProjection.notification_id && run(`select count(*)::text from public.in_app_notifications where source_incident_event_id='${acknowledged.event_id}';`) === '1');

  pass('owner Worker can select own notification through RLS', run(roleSql(actors.worker, `select count(*)::text from public.in_app_notifications where id='${ackProjection.notification_id}';`)).endsWith('1'));
  pass('foreign Worker cannot select notification through RLS', run(roleSql(actors.foreignWorker, `select count(*)::text from public.in_app_notifications where id='${ackProjection.notification_id}';`)).endsWith('0'));
  pass('Manager cannot select recipient notification content', run(roleSql(actors.manager, `select count(*)::text from public.in_app_notifications where id='${ackProjection.notification_id}';`)).endsWith('0'));
  pass('System Admin cannot select recipient notification content', run(roleSql(actors.admin, `select count(*)::text from public.in_app_notifications where id='${ackProjection.notification_id}';`)).endsWith('0'));
  pass('anon has no notification table privilege', run(`select (not has_table_privilege('anon','public.in_app_notifications','SELECT'))::text;`) === 'true');
  pass('authenticated has no direct notification writes', run(`select bool_and(not has_table_privilege('authenticated','public.in_app_notifications',p))::text from unnest(array['INSERT','UPDATE','DELETE']) p;`) === 'true');

  const forbiddenProjection = project(actors.worker, acknowledged.event_id);
  pass('Worker cannot invoke admin projection authority', !forbiddenProjection.ok && forbiddenProjection.code === 'FORBIDDEN');
  const unknownProjection = project(actors.manager, 'ffffffff-ffff-ffff-ffff-ffffffffffff');
  pass('unknown source is non-disclosing', !unknownProjection.ok && unknownProjection.code === 'NOT_FOUND');

  const read = result(roleSql(actors.worker, `select public.mark_in_app_notification_read('${ackProjection.notification_id}'::uuid)::text;`));
  pass('owner Worker marks unread notification at server time', read.ok && !read.replayed && read.read_at && run(`select (read_at is not null and read_at>=created_at)::text from public.in_app_notifications where id='${ackProjection.notification_id}';`) === 'true');
  const readReplay = result(roleSql(actors.worker, `select public.mark_in_app_notification_read('${ackProjection.notification_id}'::uuid)::text;`));
  pass('mark-read replay preserves first read timestamp', readReplay.ok && readReplay.replayed && readReplay.read_at === read.read_at);
  pass('foreign Worker mark-read is non-disclosing', result(roleSql(actors.foreignWorker, `select public.mark_in_app_notification_read('${ackProjection.notification_id}'::uuid)::text;`)).code === 'NOT_FOUND');
  pass('Manager mark-read is non-disclosing', result(roleSql(actors.manager, `select public.mark_in_app_notification_read('${ackProjection.notification_id}'::uuid)::text;`)).code === 'NOT_FOUND');

  const resolveCreated = createIncident(ids.resolveAssignment, 'notification-create-resolve');
  const resolveAck = transition('acknowledge', actors.manager, resolveCreated.incident_id, 1, 'notification-resolve-ack');
  const resolved = transition('resolve', actors.admin, resolveCreated.incident_id, 2, 'notification-resolve');
  const resolvedProjection = project(actors.admin, resolved.event_id);
  pass('System Admin projects resolved event', resolvedProjection.ok && resolvedProjection.outcome === 'projected');
  pass('resolved projection uses exact controlled content', run(`select (notification_type='incident_resolved' and title='Help Requestが解決されました' and summary='Help Requestが解決済みになりました。')::text from public.in_app_notifications where id='${resolvedProjection.notification_id}';`) === 'true');
  const noRecipientResults = run(`begin; update public.workers set auth_profile_id=null where id='${workerId}'; set local role authenticated; set local request.jwt.claims='{"sub":"${actors.manager}","role":"authenticated"}'; select public.project_incident_in_app_notification('${resolveAck.event_id}'::uuid)::text; reset role; update public.workers set auth_profile_id='${actors.worker}' where id='${workerId}'; set local role authenticated; select public.project_incident_in_app_notification('${resolveAck.event_id}'::uuid)::text; commit;`).split(/\r?\n/).filter((line) => line.startsWith('{')).map(JSON.parse);
  pass('missing account writes terminal no-recipient receipt', noRecipientResults[0].ok && noRecipientResults[0].outcome === 'skipped_no_recipient' && !noRecipientResults[0].notification_id);
  pass('later account link replays skip without historical notification', noRecipientResults[1].replayed && noRecipientResults[1].outcome === 'skipped_no_recipient' && run(`select count(*)::text from public.in_app_notifications where source_incident_event_id='${resolveAck.event_id}';`) === '0');

  const inactiveCreated = createIncident(ids.inactiveAssignment, 'notification-create-inactive');
  const inactiveAck = transition('acknowledge', actors.manager, inactiveCreated.incident_id, 1, 'notification-inactive-ack');
  const inactiveResults = run(`begin; update public.workers set status='inactive' where id='${workerId}'; set local role authenticated; set local request.jwt.claims='{"sub":"${actors.manager}","role":"authenticated"}'; select public.project_incident_in_app_notification('${inactiveAck.event_id}'::uuid)::text; reset role; update public.workers set status='active' where id='${workerId}'; set local role authenticated; select public.project_incident_in_app_notification('${inactiveAck.event_id}'::uuid)::text; commit;`).split(/\r?\n/).filter((line) => line.startsWith('{')).map(JSON.parse);
  pass('inactive Worker writes terminal inactive-recipient receipt', inactiveResults[0].outcome === 'skipped_inactive_recipient' && !inactiveResults[0].notification_id);
  pass('reactivation replays skip without historical notification', inactiveResults[1].replayed && inactiveResults[1].outcome === 'skipped_inactive_recipient' && run(`select count(*)::text from public.in_app_notifications where source_incident_event_id='${inactiveAck.event_id}';`) === '0');

  const retractCreated = createIncident(ids.retractAssignment, 'notification-create-retract');
  const retracted = transition('retract', actors.worker, retractCreated.incident_id, 1, 'notification-retract');
  pass('retracted source event is explicitly not applicable', project(actors.manager, retracted.event_id).code === 'NOT_APPLICABLE');
  pass('source event facts are unchanged by projection', run(`select (event_type='acknowledged' and version_from=1 and version_to=2)::text from public.operational_incident_events where id='${acknowledged.event_id}';`) === 'true');

  pass('terminal skip is absent from reconciliation discovery', Number(run(`select count(*)::text from private.list_unprojected_incident_notification_events(null,null,100) where source_event_id='${resolveAck.event_id}';`)) === 0);
  pass('projected resolved event is absent from reconciliation discovery', Number(run(`select count(*)::text from private.list_unprojected_incident_notification_events(null,null,100) where source_event_id='${resolved.event_id}';`)) === 0);
  pass('private reconciliation function is unavailable to runtime roles', run(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['public','anon','authenticated','service_role']) r where n.nspname='private' and p.proname='list_unprojected_incident_notification_events';`) === 'true');
  pass('reconciliation page size is bounded to 100', Number(run(`select count(*)::text from private.list_unprojected_incident_notification_events(null,null,1000);`)) <= 100);

  const raceCreated = createIncident(ids.raceAssignment, 'notification-create-race');
  const raceAck = transition('acknowledge', actors.manager, raceCreated.incident_id, 1, 'notification-race-ack');
  const raceSql = roleSql(actors.manager, `select public.project_incident_in_app_notification('${raceAck.event_id}'::uuid)::text;`);
  const [raceA, raceB] = await Promise.all([concurrent(raceSql), concurrent(raceSql)]);
  pass('concurrent projection converges on one notification', raceA.ok && raceB.ok && raceA.notification_id === raceB.notification_id && [raceA, raceB].filter((item) => item.replayed).length === 1);
  pass('concurrent projection writes one receipt and one item', run(`select ((select count(*) from private.incident_notification_projection_receipts where source_incident_event_id='${raceAck.event_id}')=1 and (select count(*) from public.in_app_notifications where source_incident_event_id='${raceAck.event_id}')=1)::text;`) === 'true');
  const readRaceSql = roleSql(actors.worker, `select public.mark_in_app_notification_read('${resolvedProjection.notification_id}'::uuid)::text;`);
  const [readRaceA, readRaceB] = await Promise.all([concurrent(readRaceSql), concurrent(readRaceSql)]);
  pass('concurrent mark-read converges on one first timestamp', readRaceA.ok && readRaceB.ok && readRaceA.read_at === readRaceB.read_at && [readRaceA, readRaceB].filter((item) => item.replayed).length === 1);

  pass('public RPCs are security-definer, empty-search-path, authenticated-only', run(`select bool_and(p.prosecdef and p.proconfig[1]='search_path=""' and has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('public',p.oid,'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('project_incident_in_app_notification','mark_in_app_notification_read');`) === 'true');
  pass('notification source uniqueness is enforced', run(`select count(*)::text from pg_constraint where conname='in_app_notifications_source_recipient_key';`) === '1');
  pass('activation watermark is a single valid cursor', run(`select (count(*)=1 and bool_and(singleton) and bool_and(activation_created_at is not null) and bool_and(activation_event_id is not null))::text from private.incident_notification_projection_state;`) === 'true');
} finally {
  cleanup();
}

pass('notification fixtures and projections are cleaned up', run(`select ((select count(*) from public.assignments where id::text like '98000000-0000-0000-0002-%')+(select count(*) from public.in_app_notifications n join public.operational_incident_events e on e.id=n.source_incident_event_id join public.operational_incidents i on i.id=e.incident_id where i.assignment_id::text like '98000000-0000-0000-0002-%'))::text;`) === '0');
console.log(`Worker In-app Notification: ${passed}/${passed} passed`);
