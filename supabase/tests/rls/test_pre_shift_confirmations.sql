reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_allowed('RLS-PSC-001', 'Critical', $$insert into public.pre_shift_confirmations (id, assignment_id, can_work, health_status) values ('50000000-0000-0000-0000-000000000091','40000000-0000-0000-0000-000000000001',true,'good')$$, 'INSERT', 'own future assignment confirmation');
select test_rls.assert_denied('RLS-PSC-002', 'IDOR', $$insert into public.pre_shift_confirmations (id, assignment_id, can_work, health_status) values ('50000000-0000-0000-0000-000000000092','40000000-0000-0000-0000-000000000002',true,'good')$$, 'INSERT', 'Worker B assignment confirmation');
select test_rls.assert_denied('RLS-PSC-003', 'Critical', $$insert into public.pre_shift_confirmations (id, assignment_id, can_work, health_status) values ('50000000-0000-0000-0000-000000000093','40000000-0000-0000-0000-000000000004',true,'good')$$, 'INSERT', 'past assignment confirmation');
select test_rls.assert_allowed('RLS-PSC-004', 'Critical', $$update public.pre_shift_confirmations set comment = 'TEST updated' where id = '50000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'future confirmation');
select test_rls.assert_denied('RLS-PSC-005', 'Critical', $$update public.pre_shift_confirmations set comment = 'TEST changed' where id = '50000000-0000-0000-0000-000000000004'$$, 'UPDATE', 'past confirmation');
select test_rls.assert_count('RLS-PSC-IDOR', 'IDOR', $$select * from public.pre_shift_confirmations where assignment_id = '40000000-0000-0000-0000-000000000002'$$, 0, 'Worker B confirmation');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_count('RLS-PSC-006A', 'Critical', $$select * from public.pre_shift_confirmations where id = '50000000-0000-0000-0000-000000000001'$$, 1, 'Nagoya confirmation');
select test_rls.assert_allowed('RLS-PSC-006B', 'Critical', $$update public.pre_shift_confirmations set comment = 'TEST manager update' where id = '50000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'Nagoya confirmation');
select test_rls.assert_denied('RLS-PSC-007', 'IDOR', $$update public.pre_shift_confirmations set comment = 'TEST forbidden' where id = '50000000-0000-0000-0000-000000000002'$$, 'UPDATE', 'Tokyo confirmation');
