reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-BR-001', 'Critical', $$select * from public.branches where code = 'NAGOYA_TEST'$$, 1, 'Nagoya branch');
select test_rls.assert_count('RLS-BR-002', 'Critical', $$select * from public.branches where code = 'TOKYO_TEST'$$, 0, 'Tokyo branch');
select test_rls.assert_denied('RLS-BR-006A', 'Critical', $$insert into public.branches (code, name) values ('TEST_FORBIDDEN_W', 'TEST forbidden')$$, 'INSERT', 'branches');
select test_rls.assert_denied('RLS-BR-006B', 'Critical', $$update public.branches set name = 'TEST changed' where code = 'NAGOYA_TEST'$$, 'UPDATE', 'Nagoya branch');
select test_rls.assert_value('RLS-HF-001', 'Critical', $$private.current_worker_id()$$, 'c0000000-0000-0000-0000-000000000001', 'current_worker_id');
select test_rls.assert_value('RLS-HF-002', 'Critical', $$private.is_system_admin()$$, 'false', 'is_system_admin');
select test_rls.assert_value('RLS-HF-003', 'Critical', $$private.has_branch_access('b0000000-0000-0000-0000-000000000001')$$, 'false', 'Nagoya branch access');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_count('RLS-BR-003', 'Critical', $$select * from public.branches where code = 'NAGOYA_TEST'$$, 1, 'Nagoya branch');
select test_rls.assert_count('RLS-BR-004', 'Critical', $$select * from public.branches where code = 'TOKYO_TEST'$$, 0, 'Tokyo branch');
select test_rls.assert_denied('RLS-BR-006C', 'Critical', $$insert into public.branches (code, name) values ('TEST_FORBIDDEN_M', 'TEST forbidden')$$, 'INSERT', 'branches');
select test_rls.assert_value('RLS-HF-004', 'Critical', $$private.current_worker_id()$$, null, 'current_worker_id');
select test_rls.assert_value('RLS-HF-005', 'Critical', $$private.has_branch_access('b0000000-0000-0000-0000-000000000001')$$, 'true', 'Nagoya branch access');
select test_rls.assert_value('RLS-HF-006', 'Critical', $$private.has_branch_access('b0000000-0000-0000-0000-000000000002')$$, 'false', 'Tokyo branch access');

reset role; set role authenticated;
select test_rls.set_actor('System Admin', 'a0000000-0000-0000-0000-000000000005');
select test_rls.assert_count('RLS-BR-005', 'Critical', $$select * from public.branches where code in ('NAGOYA_TEST', 'TOKYO_TEST')$$, 2, 'all test branches');
select test_rls.assert_allowed('RLS-BR-007', 'Critical', $$insert into public.branches (id, code, name) values ('b0000000-0000-0000-0000-000000000099', 'TEST_ADMIN_BRANCH', 'TEST Admin Branch')$$, 'INSERT', 'branches');
select test_rls.assert_value('RLS-HF-007', 'Critical', $$private.is_system_admin()$$, 'true', 'is_system_admin');
select test_rls.assert_value('RLS-HF-008', 'Critical', $$private.has_branch_access('b0000000-0000-0000-0000-000000000001')$$, 'true', 'Nagoya branch access');
select test_rls.assert_value('RLS-HF-009', 'Critical', $$private.has_branch_access('b0000000-0000-0000-0000-000000000002')$$, 'true', 'Tokyo branch access');

