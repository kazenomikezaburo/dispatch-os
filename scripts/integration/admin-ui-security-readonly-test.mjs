// Local-only read-only regression checks. No fixture/Auth/GRANT/RLS modifications.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const statusOutput = process.platform === 'win32'
  ? execFileSync('powershell.exe', ['-NoProfile', '-Command', 'npx supabase status -o json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']})
  : execFileSync('npx', ['supabase','status','-o','json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']});
const status = JSON.parse(statusOutput.slice(statusOutput.indexOf('{')));
assert.ok(['127.0.0.1','localhost'].includes(new URL(status.API_URL).hostname), 'Non-local Supabase rejected');
const sql = `begin read only;
select 'RLS enabled', bool_and(relrowsecurity)::text from pg_class where oid in ('public.projects'::regclass,'public.jobs'::regclass,'public.shift_slots'::regclass);
select 'anon no business read', (not has_table_privilege('anon','public.projects','SELECT') and not has_table_privilege('anon','public.jobs','SELECT') and not has_table_privilege('anon','public.shift_slots','SELECT'))::text;
select 'no authenticated delete', (not has_table_privilege('authenticated','public.projects','DELETE') and not has_table_privilege('authenticated','public.jobs','DELETE') and not has_table_privilege('authenticated','public.shift_slots','DELETE'))::text;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select 'manager own project', (count(*)=1)::text from public.projects where id='e0000000-0000-0000-0000-000000000001';
select 'manager cross branch project hidden', (count(*)=0)::text from public.projects where id='e0000000-0000-0000-0000-000000000003';
select 'manager cross branch job hidden', (count(*)=0)::text from public.jobs where id='10000000-0000-0000-0000-000000000003';
select 'manager cross branch shift hidden', (count(*)=0)::text from public.shift_slots where id='20000000-0000-0000-0000-000000000003';
rollback;`;
const output = execFileSync('docker', ['exec','-i','supabase_db_dispatch-os','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-q'], {input:sql,encoding:'utf8'});
const rows = output.trim().split(/\r?\n/);
for (const row of rows) { const [name,result] = row.split('|'); assert.equal(result,'true', name); console.log(`PASS ${name}`); }
assert.equal(rows.length, 7);
console.log('Read-only local security regression: 7/7 passed');
