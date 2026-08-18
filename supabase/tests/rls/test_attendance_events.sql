reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_allowed('RLS-AE-001', 'Attendance Integrity', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000091','40000000-0000-0000-0000-000000000001','depart','worker','61000000-0000-0000-0000-000000000091')$$, 'INSERT', 'own attendance event');
select test_rls.assert_denied('RLS-AE-002', 'IDOR', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000092','40000000-0000-0000-0000-000000000002','depart','worker','61000000-0000-0000-0000-000000000092')$$, 'INSERT', 'Worker B assignment event');
select test_rls.assert_denied('RLS-AE-003', 'Privilege Escalation', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000093','40000000-0000-0000-0000-000000000001','depart','manager','61000000-0000-0000-0000-000000000093')$$, 'INSERT', 'manager source spoof');
select test_rls.assert_denied('RLS-AE-004', 'Attendance Integrity', $$update public.attendance_events set event_type = 'end_work' where id = '60000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'existing event');
select test_rls.assert_denied('RLS-AE-005', 'Attendance Integrity', $$delete from public.attendance_events where id = '60000000-0000-0000-0000-000000000001'$$, 'DELETE', 'existing event');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_allowed('RLS-AE-006', 'Attendance Integrity', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000094','40000000-0000-0000-0000-000000000002','depart','manager','61000000-0000-0000-0000-000000000094')$$, 'INSERT', 'Nagoya manager event');
select test_rls.assert_denied('RLS-AE-007', 'Attendance Integrity', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000095','40000000-0000-0000-0000-000000000002','depart','worker','61000000-0000-0000-0000-000000000095')$$, 'INSERT', 'worker source spoof');
select test_rls.assert_denied('RLS-AE-008', 'IDOR', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000096','40000000-0000-0000-0000-000000000003','depart','manager','61000000-0000-0000-0000-000000000096')$$, 'INSERT', 'Tokyo assignment event');

reset role; set role authenticated;
select test_rls.set_actor('System Admin', 'a0000000-0000-0000-0000-000000000005');
select test_rls.assert_allowed('RLS-AE-009', 'Attendance Integrity', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000097','40000000-0000-0000-0000-000000000003','depart','manager','61000000-0000-0000-0000-000000000097')$$, 'INSERT', 'system admin manager event');
select test_rls.assert_denied('RLS-AE-010', 'Privilege Escalation', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000098','40000000-0000-0000-0000-000000000003','depart','worker','61000000-0000-0000-0000-000000000098')$$, 'INSERT', 'system admin worker source');
select test_rls.assert_denied('RLS-AE-011', 'Attendance Integrity', $$update public.attendance_events set event_type = 'end_work' where id = '60000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'existing event');
select test_rls.assert_denied('RLS-AE-012', 'Attendance Integrity', $$delete from public.attendance_events where id = '60000000-0000-0000-0000-000000000003'$$, 'DELETE', 'existing event');

