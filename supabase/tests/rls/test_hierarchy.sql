reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-HIER-001A', 'Critical', $$select * from public.workplaces where id = 'f0000000-0000-0000-0000-000000000001'$$, 1, 'N1 workplace');
select test_rls.assert_count('RLS-HIER-001B', 'Critical', $$select * from public.jobs where id = '10000000-0000-0000-0000-000000000001'$$, 1, 'Job N1');
select test_rls.assert_count('RLS-HIER-001C', 'Critical', $$select * from public.shift_slots where id = '20000000-0000-0000-0000-000000000001'$$, 1, 'Shift N1');
select test_rls.assert_count('RLS-HIER-002A', 'IDOR', $$select * from public.workplaces where id = 'f0000000-0000-0000-0000-000000000002'$$, 0, 'Tokyo workplace');
select test_rls.assert_count('RLS-HIER-002B', 'IDOR', $$select * from public.jobs where id = '10000000-0000-0000-0000-000000000003'$$, 0, 'Job T1');
select test_rls.assert_count('RLS-HIER-002C', 'IDOR', $$select * from public.shift_slots where id = '20000000-0000-0000-0000-000000000003'$$, 0, 'Shift T1');
select test_rls.assert_count('RLS-HIER-003A', 'Critical', $$select * from public.jobs where id = '10000000-0000-0000-0000-000000000002'$$, 1, 'closed Job N2');
select test_rls.assert_count('RLS-HIER-003B', 'Critical', $$select * from public.shift_slots where id = '20000000-0000-0000-0000-000000000002'$$, 1, 'closed Shift N2');

reset role; set role authenticated;
select test_rls.set_actor('Worker B', 'a0000000-0000-0000-0000-000000000002');
select test_rls.assert_count('RLS-HIER-004A', 'IDOR', $$select * from public.jobs where id = '10000000-0000-0000-0000-000000000002'$$, 0, 'closed Job N2');
select test_rls.assert_count('RLS-HIER-004B', 'IDOR', $$select * from public.shift_slots where id = '20000000-0000-0000-0000-000000000002'$$, 0, 'closed Shift N2');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_denied('RLS-HIER-005', 'IDOR', $$update public.jobs set name = 'TEST changed' where id = '10000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'Job T1');
select test_rls.assert_denied('RLS-HIER-006', 'IDOR', $$update public.shift_slots set job_id = '10000000-0000-0000-0000-000000000003' where id = '20000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'Shift N1 to Job T1');

