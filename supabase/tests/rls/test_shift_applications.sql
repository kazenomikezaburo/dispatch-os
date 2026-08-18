reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-APP-001', 'Critical', $$select * from public.shift_applications where id = '30000000-0000-0000-0000-000000000001'$$, 1, 'own application');
select test_rls.assert_count('RLS-APP-002', 'IDOR', $$select * from public.shift_applications where id = '30000000-0000-0000-0000-000000000002'$$, 0, 'Worker B application');
select test_rls.assert_allowed('RLS-APP-003', 'Critical', $$insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('30000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','applied')$$, 'INSERT', 'Shift N1 as Worker A');
select test_rls.assert_denied('RLS-APP-004', 'IDOR', $$insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('30000000-0000-0000-0000-000000000092','20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','applied')$$, 'INSERT', 'Shift N1 as Worker B');
select test_rls.assert_denied('RLS-APP-005', 'Critical', $$insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('30000000-0000-0000-0000-000000000093','20000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','applied')$$, 'INSERT', 'Tokyo Shift T1 direct UUID');
select test_rls.assert_denied('RLS-APP-006', 'Critical', $$insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('30000000-0000-0000-0000-000000000094','20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','accepted')$$, 'INSERT', 'accepted application');
select test_rls.assert_denied('RLS-APP-007', 'Critical', $$insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('30000000-0000-0000-0000-000000000095','20000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','applied')$$, 'INSERT', 'closed Shift N2');
select test_rls.assert_denied('RLS-APP-008', 'Critical', $$update public.shift_applications set cancel_reason = 'TEST cancel' where id = '30000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'own application');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_denied('RLS-APP-009', 'IDOR', $$update public.shift_applications set status = 'accepted' where shift_slot_id = '20000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'Tokyo application');

