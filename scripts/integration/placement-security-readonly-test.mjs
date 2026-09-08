// Local-only SQL authorization verification. No fixtures, Auth changes or data writes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const statusOutput = process.platform === 'win32'
  ? execFileSync('powershell.exe', ['-NoProfile', '-Command', 'npx supabase status -o json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  : execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const status = JSON.parse(statusOutput.slice(statusOutput.indexOf('{')));
const api = new URL(status.API_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(api.hostname), 'Non-local Supabase rejected');
assert.equal(api.protocol, 'http:', 'Unexpected local API protocol');
assert.equal(api.port, '54321', 'Unexpected local API port');

// Existing IDs only. SET LOCAL changes this read-only transaction, not Auth/data.
const sql = `begin read only;
select 'Placement relations have RLS', bool_and(relrowsecurity)::text from pg_class where oid in ('public.projects'::regclass,'public.jobs'::regclass,'public.shift_slots'::regclass,'public.assignments'::regclass,'public.workers'::regclass);
select 'anon has no Placement reads', bool_and(not has_table_privilege('anon', relation, 'SELECT'))::text from unnest(array['public.projects','public.jobs','public.shift_slots','public.assignments','public.workers']) as relations(relation);
select 'authenticated Assignment read granted', has_table_privilege('authenticated','public.assignments','SELECT')::text;
select 'authenticated Assignment writes denied', (not has_table_privilege('authenticated','public.assignments','INSERT') and not has_table_privilege('authenticated','public.assignments','UPDATE') and not has_table_privilege('authenticated','public.assignments','DELETE'))::text;
select 'Placement relations have no authenticated delete', bool_and(not has_table_privilege('authenticated', relation, 'DELETE'))::text from unnest(array['public.projects','public.jobs','public.shift_slots','public.assignments','public.workers']) as relations(relation);
select 'Assignment write policies absent', (count(*)=0)::text from pg_policies where schemaname='public' and tablename='assignments' and cmd in ('INSERT','UPDATE','DELETE','ALL');
select 'anon Assignment creation RPC denied', (not has_function_privilege('anon','public.create_assignment_from_application(uuid,uuid)','EXECUTE'))::text;
select 'anon Assignment cancellation RPC denied', (not has_function_privilege('anon','public.cancel_assignment_by_company(uuid,uuid)','EXECUTE'))::text;
select 'existing role fixtures available', (count(*)=3)::text from public.profiles where is_active and (id,account_type) in (('a0000000-0000-0000-0000-000000000004'::uuid,'manager'),('a0000000-0000-0000-0000-000000000005'::uuid,'system_admin'),('a0000000-0000-0000-0000-000000000001'::uuid,'worker'));
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select 'Manager own Shift visible', (count(*)=1)::text from public.shift_slots where id='20000000-0000-0000-0000-000000000001';
select 'Manager own Assignment visible', (count(*)=1)::text from public.assignments where id='40000000-0000-0000-0000-000000000002';
select 'Manager own Worker visible', (count(*)=1)::text from public.workers where id='c0000000-0000-0000-0000-000000000002';
select 'Manager foreign Project hidden', (count(*)=0)::text from public.projects where id='e0000000-0000-0000-0000-000000000003';
select 'Manager foreign Shift hidden', (count(*)=0)::text from public.shift_slots where id='20000000-0000-0000-0000-000000000003';
select 'Manager foreign Assignment hidden', (count(*)=0)::text from public.assignments where id='40000000-0000-0000-0000-000000000003';
select 'Manager foreign Worker hidden', (count(*)=0)::text from public.workers where id='c0000000-0000-0000-0000-000000000003';
select 'Manager dated Shift join is branch-scoped', (count(*)=0)::text from public.assignments a join public.shift_slots s on s.id=a.shift_slot_id join public.jobs j on j.id=s.job_id join public.projects p on p.id=j.project_id where p.branch_id='b0000000-0000-0000-0000-000000000002' and s.starts_at>='2099-03-15T00:00:00+09:00' and s.starts_at<'2099-03-16T00:00:00+09:00';
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select 'System Admin sees both branch Shifts', (count(*)=2)::text from public.shift_slots where id in ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003');
select 'System Admin sees both branch Assignments', (count(*)=2)::text from public.assignments where id in ('40000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003');
select 'System Admin sees both branch Workers', (count(*)=2)::text from public.workers where id in ('c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003');
select 'System Admin branch access recognized', (private.has_branch_access('b0000000-0000-0000-0000-000000000001') and private.has_branch_access('b0000000-0000-0000-0000-000000000002'))::text;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select 'Worker own Assignment visible', (count(*)=1)::text from public.assignments where id='40000000-0000-0000-0000-000000000001';
select 'Worker other same-branch Assignment hidden', (count(*)=0)::text from public.assignments where id='40000000-0000-0000-0000-000000000002';
select 'Worker foreign Assignment hidden', (count(*)=0)::text from public.assignments where id='40000000-0000-0000-0000-000000000003';
select 'Worker own profile row visible', (count(*)=1)::text from public.workers where id='c0000000-0000-0000-0000-000000000001';
select 'Worker other staff rows hidden', (count(*)=0)::text from public.workers where id in ('c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003');
select 'Worker foreign Shift hidden', (count(*)=0)::text from public.shift_slots where id='20000000-0000-0000-0000-000000000003';
select 'Worker has no manager branch entitlement', (not private.has_branch_access('b0000000-0000-0000-0000-000000000001') and not private.is_system_admin())::text;
rollback;`;
const output = execFileSync('docker', ['exec', '-i', 'supabase_db_dispatch-os', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const rows = output.trim().split(/\r?\n/);
assert.equal(rows.length, 28, 'All expected checks must execute');
for (const row of rows) {
  const [name, result] = row.split('|');
  assert.equal(result, 'true', name);
  console.log(`PASS ${name}`);
}
console.log(`Placement read-only local security: ${rows.length}/${rows.length} passed`);
