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
const branches = {
  nagoya: 'b0000000-0000-0000-0000-000000000001',
  tokyo: 'b0000000-0000-0000-0000-000000000002',
};
const prefix = 'db29b-';

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

function result(sql) {
  return JSON.parse(run(sql).split(/\r?\n/).at(-1));
}

function rpc(actor, expression) {
  return result(roleSql(actor, `select (${expression})::text;`));
}

function create(actor, { scope = 'branch', branch = branches.nagoya, title = '', body = '', importance = 'normal', key }) {
  return rpc(actor, `public.create_announcement_draft(${literal(scope)},${branch ? `'${branch}'::uuid` : 'null'},${literal(title)},${literal(body)},${literal(importance)},${literal(key)})`);
}

function update(actor, id, version, { scope = 'branch', branch = branches.nagoya, title = '', body = '', importance = 'normal', key }) {
  return rpc(actor, `public.update_announcement_draft('${id}'::uuid,${version},${literal(scope)},${branch ? `'${branch}'::uuid` : 'null'},${literal(title)},${literal(body)},${literal(importance)},${literal(key)})`);
}

function transition(actor, command, id, version, key) {
  const functionName = command === 'delete_draft' ? 'delete_announcement_draft' : `${command}_announcement`;
  return rpc(actor, `public.${functionName}('${id}'::uuid,${version},${literal(key)})`);
}

function listAdmin(actor, state = null) {
  return rpc(actor, `public.list_admin_announcements(100,null,null,${literal(state)})`);
}

function getAdmin(actor, id) {
  return rpc(actor, `public.get_admin_announcement('${id}'::uuid)`);
}

function listWorker(actor) {
  return rpc(actor, 'public.list_worker_announcements(100,null,null)');
}

function getWorker(actor, id) {
  return rpc(actor, `public.get_worker_announcement('${id}'::uuid)`);
}

function concurrent(actor, expression) {
  const sql = roleSql(actor, `select (${expression})::text;`);
  return new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0
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
alter table public.announcement_recipients disable trigger enforce_announcement_recipient_immutability;
alter table public.announcements disable trigger enforce_announcement_delete;
delete from public.announcement_recipients where announcement_id in (
  select id from public.announcements where title like 'DB29B %'
);
delete from public.announcements where title like 'DB29B %' or title = '';
delete from private.announcement_command_receipts where idempotency_key like '${prefix}%';
alter table public.announcement_recipients enable trigger enforce_announcement_recipient_immutability;
alter table public.announcements enable trigger enforce_announcement_delete;
commit;`);
}

try {
  cleanup();

  const draft = create(actors.manager, { title: '', body: '', key: `${prefix}create-manager` });
  pass('Manager creates incomplete branch draft at version 1', draft.ok && draft.state === 'draft' && draft.version === 1 && !draft.replayed);
  pass('create replay returns the original draft', create(actors.manager, { title: '', body: '', key: `${prefix}create-manager` }).replayed === true);
  pass('create key conflict is stable', create(actors.manager, { title: 'different', body: '', key: `${prefix}create-manager` }).code === 'IDEMPOTENCY_CONFLICT');
  pass('Manager cannot create organization scope', create(actors.manager, { scope: 'organization', branch: null, title: 'DB29B forbidden', body: 'body', key: `${prefix}manager-org` }).code === 'NOT_FOUND');
  pass('Manager cannot create foreign branch scope', create(actors.manager, { branch: branches.tokyo, title: 'DB29B foreign', body: 'body', key: `${prefix}manager-foreign` }).code === 'NOT_FOUND');
  pass('Worker cannot create a draft', create(actors.workerA, { title: 'DB29B worker', body: 'body', key: `${prefix}worker-create` }).code === 'FORBIDDEN');

  const edited = update(actors.manager, draft.announcement_id, 1, {
    title: '  DB29B Manager notice  ', body: '  first line\nsecond line  ', importance: 'important', key: `${prefix}update-manager`,
  });
  pass('Manager updates and normalizes draft at adjacent version', edited.ok && edited.version === 2);
  pass('draft update replay precedes stale version check', update(actors.manager, draft.announcement_id, 1, {
    title: '  DB29B Manager notice  ', body: '  first line\nsecond line  ', importance: 'important', key: `${prefix}update-manager`,
  }).replayed === true);
  pass('stale draft update returns VERSION_CONFLICT', update(actors.manager, draft.announcement_id, 1, {
    title: 'DB29B stale', body: 'body', key: `${prefix}update-stale`,
  }).code === 'VERSION_CONFLICT');
  pass('normalized content and preserved line break are stored', run(`select (title='DB29B Manager notice' and body=E'first line\\nsecond line')::text from public.announcements where id='${draft.announcement_id}';`) === 'true');

  const published = transition(actors.manager, 'publish', draft.announcement_id, 2, `${prefix}publish-manager`);
  pass('Manager publishes branch Announcement atomically', published.ok && published.state === 'published' && published.version === 3 && published.recipient_count === 2);
  pass('publish replay returns original publication', transition(actors.manager, 'publish', draft.announcement_id, 2, `${prefix}publish-manager`).replayed === true);
  pass('branch snapshot contains exactly active eligible branch Workers', run(`select (count(*)=2 and bool_and(worker_id in ('${workers.workerA}','${workers.workerB}')))::text from public.announcement_recipients where announcement_id='${draft.announcement_id}';`) === 'true');
  pass('published update is rejected by lifecycle', update(actors.manager, draft.announcement_id, 3, {
    title: 'DB29B changed', body: 'body', key: `${prefix}published-update`,
  }).code === 'STATE_CONFLICT');
  pass('published delete is rejected', transition(actors.manager, 'delete_draft', draft.announcement_id, 3, `${prefix}published-delete`).code === 'STATE_CONFLICT');

  const workerAList = listWorker(actors.workerA);
  const workerCList = listWorker(actors.workerC);
  pass('targeted Worker list returns minimal published item', workerAList.ok && workerAList.items.some((item) => item.announcement_id === draft.announcement_id) && !('body' in workerAList.items.find((item) => item.announcement_id === draft.announcement_id)));
  pass('foreign Worker list isolates branch Announcement', workerCList.ok && !workerCList.items.some((item) => item.announcement_id === draft.announcement_id));
  const workerDetail = getWorker(actors.workerA, draft.announcement_id);
  pass('targeted Worker detail returns content without audit or target internals', workerDetail.ok && workerDetail.announcement.body.includes('second line') && !('branch_id' in workerDetail.announcement) && !('published_by' in workerDetail.announcement));
  pass('foreign Worker direct UUID is non-disclosing', getWorker(actors.workerC, draft.announcement_id).code === 'NOT_FOUND');
  pass('Manager admin detail remains available', getAdmin(actors.manager, draft.announcement_id).ok === true);
  pass('foreign Manager-equivalent branch access is absent from list', listAdmin(actors.manager).items.every((item) => item.scope_type !== 'organization' && item.branch_id === branches.nagoya));

  run(`update public.workers set status='inactive' where id='${workers.workerA}';`);
  pass('inactive Worker loses runtime read without deleting snapshot', getWorker(actors.workerA, draft.announcement_id).code === 'NOT_FOUND' && run(`select count(*)::text from public.announcement_recipients where announcement_id='${draft.announcement_id}' and worker_id='${workers.workerA}';`) === '1');
  run(`update public.workers set status='active' where id='${workers.workerA}';`);
  pass('reactivated same Worker/profile regains published access', getWorker(actors.workerA, draft.announcement_id).ok === true);
  run(`update public.workers set branch_id='${branches.tokyo}' where id='${workers.workerA}';`);
  pass('branch move preserves immutable snapshot and access', getWorker(actors.workerA, draft.announcement_id).ok === true && run(`select count(*)::text from public.announcement_recipients where announcement_id='${draft.announcement_id}';`) === '2');
  run(`update public.workers set branch_id='${branches.nagoya}' where id='${workers.workerA}';`);

  const archived = transition(actors.manager, 'archive', draft.announcement_id, 3, `${prefix}archive-manager`);
  pass('Manager archives published Announcement at adjacent version', archived.ok && archived.state === 'archived' && archived.version === 4);
  pass('archive replay returns original result', transition(actors.manager, 'archive', draft.announcement_id, 3, `${prefix}archive-manager`).replayed === true);
  pass('archived Announcement is unavailable to Worker', getWorker(actors.workerA, draft.announcement_id).code === 'NOT_FOUND');
  pass('archived Announcement remains in Admin history with recipients', getAdmin(actors.manager, draft.announcement_id).announcement.recipient_count === 2);

  const organization = create(actors.admin, { scope: 'organization', branch: null, title: 'DB29B Organization notice', body: 'all workers', key: `${prefix}org-create` });
  const organizationPublished = transition(actors.admin, 'publish', organization.announcement_id, 1, `${prefix}org-publish`);
  pass('System Admin publishes organization scope to all eligible active Workers', organizationPublished.ok && organizationPublished.recipient_count === 3);
  pass('Manager cannot read organization Announcement', getAdmin(actors.manager, organization.announcement_id).code === 'NOT_FOUND');
  pass('all eligible Workers can read organization Announcement', [actors.workerA, actors.workerB, actors.workerC].every((actor) => getWorker(actor, organization.announcement_id).ok));
  run(`update public.workers set auth_profile_id=null where id in ('${workers.workerA}','${workers.workerB}');
update public.workers set auth_profile_id='${actors.workerB}' where id='${workers.workerA}';`);
  pass('profile relink does not remap either frozen Worker/profile identity', getWorker(actors.workerA, organization.announcement_id).code === 'NOT_FOUND' && getWorker(actors.workerB, organization.announcement_id).code === 'NOT_FOUND');
  run(`update public.workers set auth_profile_id=null where id='${workers.workerA}';
update public.workers set auth_profile_id='${actors.workerA}' where id='${workers.workerA}';
update public.workers set auth_profile_id='${actors.workerB}' where id='${workers.workerB}';`);
  run(`update public.profiles set is_active=false where id='${actors.workerB}';`);
  pass('inactive Worker profile loses runtime access without snapshot deletion', getWorker(actors.workerB, organization.announcement_id).code === 'NOT_FOUND' && run(`select count(*)::text from public.announcement_recipients where announcement_id='${organization.announcement_id}' and recipient_profile_id='${actors.workerB}';`) === '1');
  run(`update public.profiles set is_active=true where id='${actors.workerB}';`);

  const deleteDraft = create(actors.manager, { title: 'DB29B Delete draft', body: '', key: `${prefix}delete-create` });
  const deleted = transition(actors.manager, 'delete_draft', deleteDraft.announcement_id, 1, `${prefix}delete-command`);
  pass('draft-only delete physically removes root', deleted.ok && deleted.deleted && run(`select count(*)::text from public.announcements where id='${deleteDraft.announcement_id}';`) === '0');
  pass('delete replay works after physical deletion', transition(actors.manager, 'delete_draft', deleteDraft.announcement_id, 1, `${prefix}delete-command`).replayed === true);

  const emptyBranch = create(actors.admin, { branch: branches.tokyo, title: 'DB29B Empty audience', body: 'body', key: `${prefix}empty-create` });
  run(`update public.workers set status='inactive' where branch_id='${branches.tokyo}';`);
  const emptyResult = transition(actors.admin, 'publish', emptyBranch.announcement_id, 1, `${prefix}empty-publish`);
  pass('empty audience rejects publication without partial state', emptyResult.code === 'EMPTY_AUDIENCE' && run(`select (state='draft' and published_at is null and version=1)::text from public.announcements where id='${emptyBranch.announcement_id}';`) === 'true' && run(`select count(*)::text from public.announcement_recipients where announcement_id='${emptyBranch.announcement_id}';`) === '0');
  run(`update public.workers set status='active' where id='${workers.workerC}';`);

  const raceDraft = create(actors.manager, { title: 'DB29B Publish race', body: 'body', key: `${prefix}race-create` });
  const publishExpressionA = `public.publish_announcement('${raceDraft.announcement_id}'::uuid,1,'${prefix}race-publish-a')`;
  const publishExpressionB = `public.publish_announcement('${raceDraft.announcement_id}'::uuid,1,'${prefix}race-publish-b')`;
  const publishRace = await Promise.all([concurrent(actors.manager, publishExpressionA), concurrent(actors.manager, publishExpressionB)]);
  pass('publish race has exactly one success and one stable conflict', publishRace.filter((item) => item.ok).length === 1 && publishRace.filter((item) => ['VERSION_CONFLICT','STATE_CONFLICT'].includes(item.code)).length === 1);
  pass('publish race creates one recipient snapshot per Worker', run(`select count(*)::text from public.announcement_recipients where announcement_id='${raceDraft.announcement_id}';`) === '2');

  const editRaceDraft = create(actors.manager, { title: 'DB29B Edit publish race', body: 'body', key: `${prefix}edit-race-create` });
  const editExpression = `public.update_announcement_draft('${editRaceDraft.announcement_id}'::uuid,1,'branch','${branches.nagoya}'::uuid,'DB29B Edited race','body','normal','${prefix}edit-race-update')`;
  const editPublishExpression = `public.publish_announcement('${editRaceDraft.announcement_id}'::uuid,1,'${prefix}edit-race-publish')`;
  const editRace = await Promise.all([concurrent(actors.manager, editExpression), concurrent(actors.manager, editPublishExpression)]);
  pass('edit/publish race has exactly one success', editRace.filter((item) => item.ok).length === 1);

  const archiveRaceDraft = create(actors.manager, { title: 'DB29B Archive race', body: 'body', key: `${prefix}archive-race-create` });
  const archiveRacePublished = transition(actors.manager, 'publish', archiveRaceDraft.announcement_id, 1, `${prefix}archive-race-publish`);
  const archiveExpressionA = `public.archive_announcement('${archiveRaceDraft.announcement_id}'::uuid,${archiveRacePublished.version},'${prefix}archive-race-a')`;
  const archiveExpressionB = `public.archive_announcement('${archiveRaceDraft.announcement_id}'::uuid,${archiveRacePublished.version},'${prefix}archive-race-b')`;
  const archiveRace = await Promise.all([concurrent(actors.manager, archiveExpressionA), concurrent(actors.admin, archiveExpressionB)]);
  pass('archive race has exactly one success', archiveRace.filter((item) => item.ok).length === 1);

  const draftRead = create(actors.manager, { title: 'DB29B Draft hidden', body: 'body', key: `${prefix}draft-hidden` });
  pass('Worker cannot read draft direct UUID', getWorker(actors.workerA, draftRead.announcement_id).code === 'NOT_FOUND');

  const rlsProbe = run(`begin;
grant select on public.announcements, public.announcement_recipients to authenticated;
set local role authenticated;
set local request.jwt.claims='{"sub":"${actors.workerC}","role":"authenticated"}';
select json_build_object(
  'archived_root',(select count(*) from public.announcements where id='${draft.announcement_id}'),
  'organization_root',(select count(*) from public.announcements where id='${organization.announcement_id}'),
  'foreign_recipient',(select count(*) from public.announcement_recipients where announcement_id='${organization.announcement_id}' and recipient_profile_id='${actors.workerA}')
)::text;
rollback;`).split(/\r?\n/).at(-1);
  pass('RLS hides archived roots and foreign recipient rows', rlsProbe === '{"archived_root" : 0, "organization_root" : 1, "foreign_recipient" : 0}');

  const directPrivileges = run(`select bool_and(not has_table_privilege(role_name, table_name, privilege))::text
from unnest(array['public','anon','authenticated']) role_name
cross join unnest(array['public.announcements','public.announcement_recipients']) table_name
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege;`);
  pass('PUBLIC anon and authenticated have no direct table privileges', directPrivileges === 'true');
  const directDml = run(roleSql(actors.admin, `update public.announcements set title='tamper' where id='${organization.announcement_id}';`), { allowFailure: true });
  pass('System Admin direct DML is rejected', directDml.includes('permission denied'));
  const recipientDml = run(roleSql(actors.admin, `delete from public.announcement_recipients where announcement_id='${organization.announcement_id}';`), { allowFailure: true });
  pass('recipient direct DML is rejected', recipientDml.includes('permission denied'));

  const functionSecurity = run(`select bool_and(p.prosecdef and p.proowner=(select oid from pg_roles where rolname='postgres')
  and p.proconfig @> array['search_path=""']
  and has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('public',p.oid,'EXECUTE'))::text
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'create_announcement_draft','update_announcement_draft','publish_announcement','archive_announcement','delete_announcement_draft',
  'list_admin_announcements','get_admin_announcement','list_worker_announcements','get_worker_announcement'
);`);
  pass('all public RPCs are hardened and authenticated-only', functionSecurity === 'true');
  pass('RLS is enabled on both public tables', run(`select bool_and(relrowsecurity)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('announcements','announcement_recipients');`) === 'true');
  pass('private receipts are not exposed to runtime roles', run(`select bool_and(not has_table_privilege(role_name,'private.announcement_command_receipts',privilege))::text from unnest(array['public','anon','authenticated','service_role']) role_name cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege;`) === 'true');

  const notificationShape = run(`select json_build_object('types',(select pg_get_constraintdef(oid) from pg_constraint where conname='in_app_notifications_type_check'),'columns',(select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='in_app_notifications'))::text;`);
  pass('Notification schema keeps Incident sources while allowing the narrow Announcement source', notificationShape.includes('incident_acknowledged') && notificationShape.includes('source_incident_event_id') && notificationShape.includes('announcement_published') && notificationShape.includes('source_announcement_id'));
} finally {
  run(`update public.workers set status='active' where id in ('${workers.workerA}','${workers.workerB}','${workers.workerC}');
update public.workers set branch_id='${branches.nagoya}' where id in ('${workers.workerA}','${workers.workerB}');
update public.workers set branch_id='${branches.tokyo}' where id='${workers.workerC}';
update public.workers set auth_profile_id=null where id in ('${workers.workerA}','${workers.workerB}');
update public.workers set auth_profile_id='${actors.workerA}' where id='${workers.workerA}';
update public.workers set auth_profile_id='${actors.workerB}' where id='${workers.workerB}';
update public.profiles set is_active=true where id in ('${actors.workerA}','${actors.workerB}','${actors.workerC}');`);
  cleanup();
}

pass('test Announcement roots recipients and receipts are cleaned up', run(`select (
  (select count(*) from public.announcements where title like 'DB29B %' or title='')
  + (select count(*) from private.announcement_command_receipts where idempotency_key like '${prefix}%')
)::text;`) === '0');
console.log(`Announcement persistence: ${passed}/${passed} passed`);
