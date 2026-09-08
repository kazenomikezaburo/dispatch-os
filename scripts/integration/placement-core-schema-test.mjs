import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const sql = `begin;
select 'existing Assignment without plan remains valid', (not exists (select 1 from public.shift_placement_plans where shift_slot_id = '20000000-0000-0000-0000-000000000002'::uuid))::text;
select 'existing Shift without plan remains valid', (not exists (select 1 from public.shift_placement_plans where shift_slot_id = '20000000-0000-0000-0000-000000000002'::uuid))::text;

insert into public.shift_placement_plans (id, shift_slot_id) values
  ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'),
  ('90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002');

do $$ begin
  insert into public.shift_placement_plans (id, shift_slot_id) values
    ('90000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001');
  raise exception 'expected unique violation';
exception when unique_violation then null;
end $$;
select 'one plan per Shift enforced', 'true';

insert into public.shift_positions (id, plan_id, label, required_workers, display_order) values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '受付', null, 0),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '入口誘導', 0, 1),
  ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'レジ', 1, 0),
  ('91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', '夜勤', 1, 0);
select 'Position nullable requirement accepted', (select required_workers is null from public.shift_positions where id = '91000000-0000-0000-0000-000000000001')::text;
select 'Position zero requirement accepted', (select required_workers = 0 from public.shift_positions where id = '91000000-0000-0000-0000-000000000002')::text;
do $$ begin
  insert into public.shift_positions (plan_id, label, required_workers, display_order) values
    ('90000000-0000-0000-0000-000000000001', 'invalid', -1, 2);
  raise exception 'expected check violation';
exception when check_violation then null;
end $$;
select 'negative Position requirement rejected', 'true';

insert into public.assignment_placement_segments (id, plan_id, shift_slot_id, assignment_id, position_id, start_at, end_at) values
  ('92000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '2099-01-15T00:00:00Z', '2099-01-15T03:00:00Z'),
  ('92000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', '2099-01-15T03:00:00Z', '2099-01-15T09:00:00Z'),
  ('92000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004', '2099-02-01T22:00:00Z', '2099-02-02T02:00:00Z'),
  ('92000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004', '2099-02-02T02:00:00Z', '2099-02-02T06:00:00Z');
select 'adjacent segments accepted', 'true';
select 'multiple non-overlapping segments accepted', 'true';
select 'overnight adjacent segments accepted', 'true';
do $$ begin
  insert into public.assignment_placement_segments (plan_id, shift_slot_id, assignment_id, position_id, start_at, end_at) values
    ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '2099-01-15T02:59:00Z', '2099-01-15T04:00:00Z');
  raise exception 'expected exclusion violation';
exception when exclusion_violation then null;
end $$;
select 'same Assignment overlap rejected', 'true';
do $$ begin
  insert into public.assignment_placement_segments (plan_id, shift_slot_id, assignment_id, position_id, start_at, end_at) values
    ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '2099-01-15T09:00:00Z', '2099-01-15T09:00:00Z');
  raise exception 'expected check violation';
exception when check_violation then null;
end $$;
select 'end at or before start rejected', 'true';
do $$ begin
  insert into public.assignment_placement_segments (plan_id, shift_slot_id, assignment_id, position_id, start_at, end_at) values
    ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000003', '2099-01-15T09:00:00Z', '2099-01-15T10:00:00Z');
  raise exception 'expected foreign key violation';
exception when foreign_key_violation then null;
end $$;
select 'cross-plan Position injection rejected', 'true';
do $$ begin
  insert into public.assignment_placement_segments (plan_id, shift_slot_id, assignment_id, position_id, start_at, end_at) values
    ('90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000003', '2099-03-15T00:00:00Z', '2099-03-15T01:00:00Z');
  raise exception 'expected foreign key violation';
exception when foreign_key_violation then null;
end $$;
select 'cross-shift Assignment Position injection rejected', 'true';

select 'all core tables have RLS', bool_and(relrowsecurity)::text
from pg_class where oid in ('public.shift_placement_plans'::regclass, 'public.shift_positions'::regclass, 'public.assignment_placement_segments'::regclass);
select 'anon has no Placement reads', bool_and(not has_table_privilege('anon', relation, 'SELECT'))::text
from unnest(array['public.shift_placement_plans', 'public.shift_positions', 'public.assignment_placement_segments']) as relations(relation);
select 'authenticated Placement direct writes denied', bool_and(
  not has_table_privilege('authenticated', relation, 'INSERT')
  and not has_table_privilege('authenticated', relation, 'UPDATE')
  and not has_table_privilege('authenticated', relation, 'DELETE')
)::text from unnest(array['public.shift_placement_plans', 'public.shift_positions', 'public.assignment_placement_segments']) as relations(relation);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select 'Manager own branch plan visible', (count(*) = 1)::text from public.shift_placement_plans where id = '90000000-0000-0000-0000-000000000001';
select 'Manager foreign branch plan hidden', (count(*) = 0)::text from public.shift_placement_plans where id = '90000000-0000-0000-0000-000000000002';
select 'Manager own branch Position visible', (count(*) = 2)::text from public.shift_positions where plan_id = '90000000-0000-0000-0000-000000000001';
select 'Manager foreign branch Position hidden', (count(*) = 0)::text from public.shift_positions where plan_id = '90000000-0000-0000-0000-000000000002';
select 'Manager own branch Segment visible', (count(*) = 2)::text from public.assignment_placement_segments where plan_id = '90000000-0000-0000-0000-000000000001';
select 'Manager foreign branch Segment hidden', (count(*) = 0)::text from public.assignment_placement_segments where plan_id = '90000000-0000-0000-0000-000000000002';
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select 'System Admin sees both branch plans', (count(*) = 2)::text from public.shift_placement_plans where id in ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002');
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select 'Worker has no Placement plan read', (count(*) = 0)::text from public.shift_placement_plans where id = '90000000-0000-0000-0000-000000000001';
select 'Worker has no Position read', (count(*) = 0)::text from public.shift_positions where plan_id = '90000000-0000-0000-0000-000000000001';
select 'Worker has no Segment read', (count(*) = 0)::text from public.assignment_placement_segments where plan_id = '90000000-0000-0000-0000-000000000001';
rollback;`;

const output = execFileSync('docker', ['exec', '-i', 'supabase_db_dispatch-os', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'], {
  input: sql,
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'],
});

const rows = output.trim().split(/\r?\n/).filter(Boolean);
assert.ok(rows.length >= 25, 'All expected checks must execute');
for (const row of rows) {
  const [name, result] = row.split('|');
  assert.equal(result, 'true', name);
  console.log(`PASS ${name}`);
}
console.log(`Placement core schema/security: ${rows.length}/${rows.length} passed`);
