reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-WO-001', 'Critical', $$select * from public.workers where id = 'c0000000-0000-0000-0000-000000000001'$$, 1, 'own worker record');
select test_rls.assert_count('RLS-WO-002', 'IDOR', $$select * from public.workers where id = 'c0000000-0000-0000-0000-000000000002'$$, 0, 'Worker B record');
select test_rls.assert_count('RLS-WO-003', 'IDOR', $$select * from public.workers where id = 'c0000000-0000-0000-0000-000000000003'$$, 0, 'Worker C record');
select test_rls.assert_denied('RLS-WO-007', 'Privilege Escalation', $$update public.workers set branch_id = 'b0000000-0000-0000-0000-000000000002' where id = 'c0000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'own branch_id');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_count('RLS-WO-004', 'Critical', $$select * from public.workers where id in ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002')$$, 2, 'Nagoya workers');
select test_rls.assert_count('RLS-WO-005', 'IDOR', $$select * from public.workers where id = 'c0000000-0000-0000-0000-000000000003'$$, 0, 'Worker C record');
select test_rls.assert_denied('RLS-WO-006', 'Privilege Escalation', $$update public.workers set display_name = 'TEST changed' where id = 'c0000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'Worker A record');

