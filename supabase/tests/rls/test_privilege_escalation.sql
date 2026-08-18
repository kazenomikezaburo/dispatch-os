reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_denied('SEC-001', 'Privilege Escalation', $$update public.profiles set account_type = 'system_admin' where id = 'a0000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'profiles.account_type');
select test_rls.assert_denied('SEC-002', 'Privilege Escalation', $$insert into public.manager_branch_access (profile_id, branch_id) values ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001')$$, 'INSERT', 'manager_branch_access');
select test_rls.assert_denied('SEC-005', 'Privilege Escalation', $$insert into public.shift_applications (id, shift_slot_id, worker_id, status) values ('30000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','applied')$$, 'INSERT', 'Worker B application');
select test_rls.assert_denied('SEC-006', 'Privilege Escalation', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000081','40000000-0000-0000-0000-000000000001','depart','manager','61000000-0000-0000-0000-000000000081')$$, 'INSERT', 'manager source');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_denied('SEC-003', 'Privilege Escalation', $$insert into public.manager_branch_access (profile_id, branch_id) values ('a0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000002')$$, 'INSERT', 'Tokyo branch access');
select test_rls.assert_denied('SEC-004', 'Privilege Escalation', $$update public.workers set branch_id = 'b0000000-0000-0000-0000-000000000002' where id = 'c0000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'Worker A branch_id');

reset role; set role authenticated;
select test_rls.set_actor('System Admin', 'a0000000-0000-0000-0000-000000000005');
select test_rls.assert_denied('SEC-007', 'Privilege Escalation', $$insert into public.attendance_events (id, assignment_id, event_type, source, idempotency_key) values ('60000000-0000-0000-0000-000000000082','40000000-0000-0000-0000-000000000003','depart','worker','61000000-0000-0000-0000-000000000082')$$, 'INSERT', 'worker source');
select test_rls.assert_denied('SEC-008A', 'Privilege Escalation', $$update public.attendance_events set event_type = 'end_work' where id = '60000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'attendance event');
select test_rls.assert_denied('SEC-008B', 'Privilege Escalation', $$delete from public.attendance_events where id = '60000000-0000-0000-0000-000000000003'$$, 'DELETE', 'attendance event');

