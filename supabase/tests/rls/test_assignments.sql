reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-AS-001', 'Critical', $$select * from public.assignments where id = '40000000-0000-0000-0000-000000000001'$$, 1, 'own assignment');
select test_rls.assert_count('RLS-AS-002', 'IDOR', $$select * from public.assignments where id = '40000000-0000-0000-0000-000000000002'$$, 0, 'Worker B assignment');
select test_rls.assert_denied('RLS-AS-003', 'Critical', $$insert into public.assignments (id, shift_slot_id, worker_id) values ('40000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001')$$, 'INSERT', 'assignment');
select test_rls.assert_denied('RLS-AS-004', 'Critical', $$update public.assignments set status = 'completed' where id = '40000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'own assignment');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_allowed('RLS-AS-005', 'Critical', $$insert into public.assignments (id, shift_slot_id, worker_id, assigned_by) values ('40000000-0000-0000-0000-000000000092','20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004')$$, 'INSERT', 'Nagoya assignment');
select test_rls.assert_denied('RLS-AS-006', 'IDOR', $$insert into public.assignments (id, shift_slot_id, worker_id, assigned_by) values ('40000000-0000-0000-0000-000000000093','20000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004')$$, 'INSERT', 'Tokyo assignment');
select test_rls.assert_denied('RLS-AS-007', 'IDOR', $$update public.assignments set shift_slot_id = '20000000-0000-0000-0000-000000000003' where id = '40000000-0000-0000-0000-000000000002'$$, 'UPDATE', 'Nagoya assignment to Tokyo');

