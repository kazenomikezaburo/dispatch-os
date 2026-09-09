import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';

const dockerArgs = ['exec', '-i', 'supabase_db_dispatch-os', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'];
const actors = {
  workerA: 'a0000000-0000-0000-0000-000000000001',
  workerB: 'a0000000-0000-0000-0000-000000000002',
  workerC: 'a0000000-0000-0000-0000-000000000003',
  manager: 'a0000000-0000-0000-0000-000000000004',
  admin: 'a0000000-0000-0000-0000-000000000005',
};
const workers = {
  workerA: 'c0000000-0000-0000-0000-000000000001',
  workerB: 'c0000000-0000-0000-0000-000000000002',
  workerC: 'c0000000-0000-0000-0000-000000000003',
};
const jobs = { nagoya: '10000000-0000-0000-0000-000000000001', tokyo: '10000000-0000-0000-0000-000000000003' };
const statuses = ['assigned', 'confirmed', 'completed', 'cancelled_by_worker', 'cancelled_by_company', 'absent', 'no_show'];
const ids = Object.fromEntries(statuses.map((status, index) => [status, {
  shift: `97000000-0000-0000-0001-${String(index + 1).padStart(12, '0')}`,
  assignment: `97000000-0000-0000-0002-${String(index + 1).padStart(12, '0')}`,
}]));
ids.cancelledShift = { shift: '97000000-0000-0000-0001-000000000008', assignment: '97000000-0000-0000-0002-000000000008' };
ids.foreign = { shift: '97000000-0000-0000-0001-000000000009', assignment: '97000000-0000-0000-0002-000000000009' };

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

function literal(value) {
  return value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
}

function createSql(actor, assignment, category, message, key) {
  return roleSql(actor, `select public.create_operational_incident('${assignment}'::uuid, ${literal(category)}, ${literal(message)}, ${literal(key)})::text;`);
}

function transitionSql(command, actor, incident, version, key) {
  return roleSql(actor, `select public.${command}_operational_incident('${incident}'::uuid, ${version}, ${literal(key)})::text;`);
}

function result(sql) {
  return JSON.parse(run(sql).split(/\r?\n/).at(-1));
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
delete from public.operational_incident_events where incident_id in (select id from public.operational_incidents where assignment_id::text like '97000000-0000-0000-0002-%');
delete from public.operational_incidents where assignment_id::text like '97000000-0000-0000-0002-%';
delete from public.assignments where id::text like '97000000-0000-0000-0002-%';
delete from public.shift_slots where id::text like '97000000-0000-0000-0001-%';
commit;`);
}

try {
  cleanup();
  const fixtureSql = statuses.map((status, index) => `
insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status)
values ('${ids[status].shift}', '${jobs.nagoya}', now() + interval '${index + 20} days', now() + interval '${index + 20} days 8 hours', 1, 'confirmed');
insert into public.assignments (id, shift_slot_id, worker_id, source, status)
values ('${ids[status].assignment}', '${ids[status].shift}', '${workers.workerA}', 'manager', '${status}');`).join('\n');
  run(`begin; ${fixtureSql}
insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status)
values ('${ids.cancelledShift.shift}', '${jobs.nagoya}', now() + interval '30 days', now() + interval '30 days 8 hours', 1, 'cancelled');
insert into public.assignments (id, shift_slot_id, worker_id, source, status)
values ('${ids.cancelledShift.assignment}', '${ids.cancelledShift.shift}', '${workers.workerA}', 'manager', 'confirmed');
insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status)
values ('${ids.foreign.shift}', '${jobs.tokyo}', now() + interval '31 days', now() + interval '31 days 8 hours', 1, 'confirmed');
insert into public.assignments (id, shift_slot_id, worker_id, source, status)
values ('${ids.foreign.assignment}', '${ids.foreign.shift}', '${workers.workerC}', 'manager', 'confirmed');
commit;`);

  const created = result(createSql(actors.workerA, ids.assigned.assignment, 'site_access', ' 入口が不明 ', 'ops-create-1'));
  pass('own assigned create succeeds at version 1', created.ok && created.state === 'open' && created.version === 1 && !created.replayed);
  pass('message is trimmed and event is written atomically', run(`select (i.message='入口が不明' and count(e.id)=1)::text from public.operational_incidents i join public.operational_incident_events e on e.incident_id=i.id where i.id='${created.incident_id}' group by i.message;`) === 'true');
  const replay = result(createSql(actors.workerA, ids.assigned.assignment, 'site_access', ' 入口が不明 ', 'ops-create-1'));
  pass('create replay returns original without another event', replay.ok && replay.replayed && replay.event_id === created.event_id && run(`select count(*)::text from public.operational_incident_events where incident_id='${created.incident_id}';`) === '1');
  pass('same key with different request conflicts', result(createSql(actors.workerA, ids.assigned.assignment, 'other', null, 'ops-create-1')).code === 'IDEMPOTENCY_CONFLICT');
  pass('one unresolved is enforced', result(createSql(actors.workerA, ids.assigned.assignment, 'other', null, 'ops-create-active')).code === 'ACTIVE_INCIDENT_EXISTS');

  const blank = result(createSql(actors.workerA, ids.confirmed.assignment, 'other', '   ', 'ops-create-blank'));
  pass('own confirmed create succeeds and blank message normalizes to null', blank.ok && run(`select (message is null)::text from public.operational_incidents where id='${blank.incident_id}';`) === 'true');
  pass('unknown category is rejected', result(createSql(actors.workerA, ids.confirmed.assignment, 'urgent', null, 'ops-invalid-category')).code === 'INVALID_CATEGORY');
  pass('message over 500 chars is rejected', result(createSql(actors.workerA, ids.confirmed.assignment, 'other', 'x'.repeat(501), 'ops-long')).code === 'INVALID_INPUT');
  for (const status of statuses.slice(2)) {
    pass(`${status} assignment cannot create`, result(createSql(actors.workerA, ids[status].assignment, 'other', null, `ops-${status}`)).code === 'ASSIGNMENT_NOT_ELIGIBLE');
  }
  pass('cancelled Shift cannot create', result(createSql(actors.workerA, ids.cancelledShift.assignment, 'other', null, 'ops-cancelled-shift')).code === 'SHIFT_CANCELLED');
  pass('foreign Worker assignment is not disclosed', result(createSql(actors.workerB, ids.assigned.assignment, 'other', null, 'ops-foreign-worker')).code === 'NOT_FOUND');
  pass('Manager cannot create', result(createSql(actors.manager, ids.assigned.assignment, 'other', null, 'ops-manager-create')).code === 'FORBIDDEN');
  pass('System Admin cannot create', result(createSql(actors.admin, ids.assigned.assignment, 'other', null, 'ops-admin-create')).code === 'FORBIDDEN');

  const openResolve = result(transitionSql('resolve', actors.manager, created.incident_id, 1, 'ops-open-resolve'));
  pass('open cannot resolve directly', openResolve.code === 'STATE_CONFLICT');
  const ack = result(transitionSql('acknowledge', actors.manager, created.incident_id, 1, 'ops-ack-1'));
  pass('branch Manager acknowledges open incident', ack.ok && ack.state === 'acknowledged' && ack.version === 2);
  const ackReplay = result(transitionSql('acknowledge', actors.manager, created.incident_id, 1, 'ops-ack-1'));
  pass('ack replay precedes stale check', ackReplay.ok && ackReplay.replayed && ackReplay.event_id === ack.event_id);
  pass('new ack key on acknowledged incident conflicts', result(transitionSql('acknowledge', actors.manager, created.incident_id, 2, 'ops-ack-again')).code === 'STATE_CONFLICT');
  pass('Worker cannot retract acknowledged incident', result(transitionSql('retract', actors.workerA, created.incident_id, 2, 'ops-retract-after-ack')).code === 'STATE_CONFLICT');
  const resolved = result(transitionSql('resolve', actors.admin, created.incident_id, 2, 'ops-resolve-1'));
  pass('System Admin resolves acknowledged incident', resolved.ok && resolved.state === 'resolved' && resolved.version === 3);
  pass('resolve replay returns original result', result(transitionSql('resolve', actors.admin, created.incident_id, 2, 'ops-resolve-1')).replayed === true);
  pass('resolved incident cannot reopen or resolve again', result(transitionSql('resolve', actors.admin, created.incident_id, 3, 'ops-resolve-again')).code === 'STATE_CONFLICT');

  run(`update public.assignments set status='completed' where id='${ids.confirmed.assignment}'; update public.shift_slots set status='cancelled' where id='${ids.confirmed.shift}';`);
  const retracted = result(transitionSql('retract', actors.workerA, blank.incident_id, 1, 'ops-retract-1'));
  pass('owner Worker retracts open incident after Assignment and Shift become inactive', retracted.ok && retracted.state === 'retracted' && retracted.version === 2);
  pass('retract replay returns original result', result(transitionSql('retract', actors.workerA, blank.incident_id, 1, 'ops-retract-1')).replayed === true);

  const foreignCreated = result(createSql(actors.workerC, ids.foreign.assignment, 'other', null, 'ops-foreign-create'));
  pass('foreign branch Worker can create own incident', foreignCreated.ok);
  pass('Nagoya Manager cannot acknowledge Tokyo incident', result(transitionSql('acknowledge', actors.manager, foreignCreated.incident_id, 1, 'ops-foreign-ack')).code === 'NOT_FOUND');
  pass('System Admin can acknowledge cross-branch incident', result(transitionSql('acknowledge', actors.admin, foreignCreated.incident_id, 1, 'ops-admin-ack')).ok);

  const raceAssignment = ids.cancelled_by_worker.assignment;
  run(`update public.assignments set status='assigned' where id='${raceAssignment}';`);
  const [createRaceA, createRaceB] = await Promise.all([
    concurrent(createSql(actors.workerA, raceAssignment, 'other', null, 'ops-race-create-a')),
    concurrent(createSql(actors.workerA, raceAssignment, 'site_access', null, 'ops-race-create-b')),
  ]);
  pass('concurrent different-key create yields one success and one active conflict', [createRaceA, createRaceB].filter((item) => item.ok).length === 1 && [createRaceA, createRaceB].filter((item) => item.code === 'ACTIVE_INCIDENT_EXISTS').length === 1);
  const raceIncident = [createRaceA, createRaceB].find((item) => item.ok).incident_id;
  const [ackRaceA, ackRaceB] = await Promise.all([
    concurrent(transitionSql('acknowledge', actors.manager, raceIncident, 1, 'ops-race-ack-manager')),
    concurrent(transitionSql('acknowledge', actors.admin, raceIncident, 1, 'ops-race-ack-admin')),
  ]);
  pass('simultaneous ack yields exactly one success', [ackRaceA, ackRaceB].filter((item) => item.ok).length === 1);
  const [resolveRaceA, resolveRaceB] = await Promise.all([
    concurrent(transitionSql('resolve', actors.manager, raceIncident, 2, 'ops-race-resolve-manager')),
    concurrent(transitionSql('resolve', actors.admin, raceIncident, 2, 'ops-race-resolve-admin')),
  ]);
  pass('simultaneous resolve yields exactly one success', [resolveRaceA, resolveRaceB].filter((item) => item.ok).length === 1);

  const retractRaceAssignment = ids.cancelled_by_company.assignment;
  run(`update public.assignments set status='assigned' where id='${retractRaceAssignment}';`);
  const retractRaceIncident = result(createSql(actors.workerA, retractRaceAssignment, 'other', null, 'ops-retract-race-create')).incident_id;
  const [retractRace, competingAck] = await Promise.all([
    concurrent(transitionSql('retract', actors.workerA, retractRaceIncident, 1, 'ops-race-retract')),
    concurrent(transitionSql('acknowledge', actors.manager, retractRaceIncident, 1, 'ops-race-ack')),
  ]);
  pass('retract versus acknowledge yields exactly one success', [retractRace, competingAck].filter((item) => item.ok).length === 1);

  const sameKeyAssignment = ids.absent.assignment;
  run(`update public.assignments set status='assigned' where id='${sameKeyAssignment}';`);
  const sameKeySql = createSql(actors.workerA, sameKeyAssignment, 'other', null, 'ops-same-key-race');
  const [sameKeyA, sameKeyB] = await Promise.all([concurrent(sameKeySql), concurrent(sameKeySql)]);
  pass('concurrent same-key create yields success plus replay and one event', sameKeyA.ok && sameKeyB.ok && [sameKeyA, sameKeyB].filter((item) => item.replayed).length === 1 && run(`select count(*)::text from public.operational_incident_events where incident_id='${sameKeyA.incident_id}';`) === '1');

  const rlsOwn = run(roleSql(actors.workerA, `select count(*)::text from public.operational_incidents where id='${created.incident_id}';`));
  const rlsForeign = run(roleSql(actors.workerB, `select count(*)::text from public.operational_incidents where id='${created.incident_id}';`));
  const managerOwn = run(roleSql(actors.manager, `select count(*)::text from public.operational_incidents where id='${created.incident_id}';`));
  const managerForeign = run(roleSql(actors.manager, `select count(*)::text from public.operational_incidents where id='${foreignCreated.incident_id}';`));
  const adminForeign = run(roleSql(actors.admin, `select count(*)::text from public.operational_incidents where id='${foreignCreated.incident_id}';`));
  pass('root RLS allows own Worker and denies foreign Worker', rlsOwn.endsWith('1') && rlsForeign.endsWith('0'));
  pass('root RLS enforces Manager branch and System Admin cross-branch', managerOwn.endsWith('1') && managerForeign.endsWith('0') && adminForeign.endsWith('1'));
  const workerEvents = run(roleSql(actors.workerA, `select count(*)::text from public.operational_incident_events where incident_id='${created.incident_id}';`));
  const managerEvents = run(roleSql(actors.manager, `select count(*)::text from public.operational_incident_events where incident_id='${created.incident_id}';`));
  pass('event RLS denies Worker and allows branch Manager', workerEvents.endsWith('0') && Number(managerEvents.split(/\r?\n/).at(-1)) === 3);

  const dmlPrivileges = run(`select bool_and(not has_table_privilege(role_name, table_name, privilege))::text from unnest(array['anon','authenticated']) role_name cross join unnest(array['public.operational_incidents','public.operational_incident_events']) table_name cross join unnest(array['INSERT','UPDATE','DELETE']) privilege;`);
  pass('direct DML privileges are absent for anon and authenticated', dmlPrivileges === 'true');
  const workerDirectUpdate = run(roleSql(actors.workerA, `update public.operational_incidents set message='tamper' where id='${created.incident_id}';`), { allowFailure: true });
  pass('direct root update is rejected', workerDirectUpdate.includes('permission denied'));
  const adminEventDelete = run(roleSql(actors.admin, `delete from public.operational_incident_events where incident_id='${created.incident_id}';`), { allowFailure: true });
  pass('direct event delete is rejected even for System Admin', adminEventDelete.includes('permission denied'));
  const functionGrants = run(`select bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE') and not has_function_privilege('public', p.oid, 'EXECUTE') and p.prosecdef and p.proconfig[1] = 'search_path=""')::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_operational_incident','acknowledge_operational_incident','resolve_operational_incident','retract_operational_incident');`);
  pass('all RPCs are hardened and authenticated-only', functionGrants === 'true');

  const integrity = run(`select (count(*) > 0 and count(*) = (select count(*) from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id::text like '97000000-0000-0000-0002-%') and bool_and(version_to=version_from+1))::text from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id where i.assignment_id::text like '97000000-0000-0000-0002-%';`);
  pass('audit versions are adjacent and every command history is retained', integrity === 'true');
  const invalidRoot = run(`insert into public.operational_incidents (assignment_id,category,message,state,version) values ('${ids.no_show.assignment}','other',' bad ','open',1);`, { allowFailure: true });
  pass('DB constraint rejects unnormalized direct root data', invalidRoot.includes('operational_incidents_message_check'));
  const unresolvedCount = run(`select (max(c) <= 1)::text from (select count(*) c from public.operational_incidents where state in ('open','acknowledged') group by assignment_id) counts;`);
  pass('partial unique guarantees at most one unresolved per Assignment', unresolvedCount === 'true');

  const sideEffects = run(`select json_build_object('attendance_events',(select count(*) from public.attendance_events ae where ae.assignment_id::text like '97000000-0000-0000-0002-%'),'attendance_records',(select count(*) from public.attendance_records ar where ar.assignment_id::text like '97000000-0000-0000-0002-%'),'pre_shift',(select count(*) from public.pre_shift_confirmations p where p.assignment_id::text like '97000000-0000-0000-0002-%'),'placement',(select count(*) from public.assignment_placement_segments s where s.assignment_id::text like '97000000-0000-0000-0002-%'))::text;`);
  pass('Incident commands create no Attendance, Pre-shift, or Placement facts', sideEffects === '{"attendance_events" : 0, "attendance_records" : 0, "pre_shift" : 0, "placement" : 0}');
} finally {
  cleanup();
}

const remaining = run(`select ((select count(*) from public.operational_incidents i join public.assignments a on a.id=i.assignment_id where a.id::text like '97000000-0000-0000-0002-%') + (select count(*) from public.operational_incident_events e join public.operational_incidents i on i.id=e.incident_id join public.assignments a on a.id=i.assignment_id where a.id::text like '97000000-0000-0000-0002-%'))::text;`);
pass('test roots, events, and parent fixtures are cleaned up', remaining === '0');
console.log(`Operational Incident: ${passed}/${passed} passed`);
