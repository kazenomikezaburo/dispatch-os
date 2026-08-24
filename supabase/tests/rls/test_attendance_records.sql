reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-AR-001', 'Critical', $$select * from public.attendance_records where id = '70000000-0000-0000-0000-000000000001'$$, 1, 'own attendance record');
select test_rls.assert_count('RLS-AR-002', 'IDOR', $$select * from public.attendance_records where id = '70000000-0000-0000-0000-000000000002'$$, 0, 'Worker B attendance record');
select test_rls.assert_denied('RLS-AR-003A', 'Critical', $$insert into public.attendance_records (id, assignment_id, planned_start_at, planned_end_at) values ('70000000-0000-0000-0000-000000000091','40000000-0000-0000-0000-000000000005','2099-01-16 09:00:00+09','2099-01-16 18:00:00+09')$$, 'INSERT', 'own attendance record');
select test_rls.assert_denied('RLS-AR-003B', 'Critical', $$update public.attendance_records set worker_note = 'TEST changed' where id = '70000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'own attendance record');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_count('RLS-AR-004A', 'Critical', $$select * from public.attendance_records where id = '70000000-0000-0000-0000-000000000002'$$, 1, 'Nagoya attendance record');
select test_rls.assert_denied('RLS-AR-004B', 'Critical', $$insert into public.attendance_records (id, assignment_id, planned_start_at, planned_end_at) values ('70000000-0000-0000-0000-000000000092','40000000-0000-0000-0000-000000000005','2099-01-16 09:00:00+09','2099-01-16 18:00:00+09')$$, 'INSERT', 'Nagoya attendance record; RPC required');
select test_rls.assert_denied('RLS-AR-004C', 'Critical', $$update public.attendance_records set status = 'working' where id = '70000000-0000-0000-0000-000000000002'$$, 'UPDATE', 'Nagoya attendance record; RPC required');
select test_rls.assert_count('RLS-AR-005A', 'IDOR', $$select * from public.attendance_records where id = '70000000-0000-0000-0000-000000000003'$$, 0, 'Tokyo attendance record');
select test_rls.assert_denied('RLS-AR-005B', 'IDOR', $$update public.attendance_records set status = 'working' where id = '70000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'Tokyo attendance record');

reset role; set role authenticated;
select test_rls.set_actor('System Admin', 'a0000000-0000-0000-0000-000000000005');
select test_rls.assert_count('RLS-AR-006A', 'Critical', $$select * from public.attendance_records where id in ('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000003')$$, 3, 'all attendance records');
select test_rls.assert_denied('RLS-AR-006B', 'Critical', $$insert into public.attendance_records (id, assignment_id, planned_start_at, planned_end_at) values ('70000000-0000-0000-0000-000000000093','40000000-0000-0000-0000-000000000005','2099-01-16 09:00:00+09','2099-01-16 18:00:00+09')$$, 'INSERT', 'attendance record; RPC required');
select test_rls.assert_denied('RLS-AR-006C', 'Critical', $$update public.attendance_records set status = 'working' where id = '70000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'Tokyo attendance record; RPC required');
select test_rls.assert_denied('RLS-AR-007', 'Critical', $$delete from public.attendance_records where id = '70000000-0000-0000-0000-000000000003'$$, 'DELETE', 'attendance record');
