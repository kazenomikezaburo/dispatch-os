reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('IDOR-001', 'IDOR', $$select * from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'$$, 0, 'Worker B profile UUID');
select test_rls.assert_count('IDOR-002', 'IDOR', $$select * from public.workers where id = 'c0000000-0000-0000-0000-000000000003'$$, 0, 'Worker C UUID');
select test_rls.assert_count('IDOR-003', 'IDOR', $$select * from public.shift_applications where id = '30000000-0000-0000-0000-000000000002'$$, 0, 'Worker B application UUID');
select test_rls.assert_denied('IDOR-004', 'IDOR', $$insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('30000000-0000-0000-0000-000000000071','20000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','applied')$$, 'INSERT', 'Tokyo shift UUID');
select test_rls.assert_count('IDOR-005', 'IDOR', $$select * from public.assignments where id = '40000000-0000-0000-0000-000000000002'$$, 0, 'Worker B assignment UUID');
select test_rls.assert_count('IDOR-006', 'IDOR', $$select * from public.pre_shift_confirmations where id = '50000000-0000-0000-0000-000000000002'$$, 0, 'Worker C confirmation UUID');
select test_rls.assert_denied('IDOR-007', 'IDOR', $$update public.pre_shift_confirmations set comment = 'TEST IDOR' where id = '50000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'Worker B confirmation UUID');
select test_rls.assert_count('IDOR-008', 'IDOR', $$select * from public.attendance_events where id = '60000000-0000-0000-0000-000000000002'$$, 0, 'Worker B event UUID');
select test_rls.assert_denied('IDOR-009', 'IDOR', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000071','40000000-0000-0000-0000-000000000003','depart','worker','61000000-0000-0000-0000-000000000071')$$, 'INSERT', 'Tokyo assignment UUID');
select test_rls.assert_count('IDOR-010', 'IDOR', $$select * from public.attendance_records where id = '70000000-0000-0000-0000-000000000003'$$, 0, 'Worker C attendance record UUID');

