reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-PR-001', 'Critical', $$select * from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'$$, 1, 'own profile');
select test_rls.assert_count('RLS-PR-002', 'IDOR', $$select * from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'$$, 0, 'Worker B profile');
select test_rls.assert_count('RLS-PR-003', 'IDOR', $$select * from public.profiles where id = 'a0000000-0000-0000-0000-000000000004'$$, 0, 'Manager A profile');
select test_rls.assert_denied('RLS-PR-006', 'Privilege Escalation', $$update public.profiles set account_type = 'system_admin' where id = 'a0000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'own account_type');
select test_rls.assert_count('RLS-MBA-003', 'Privilege Escalation', $$select * from public.manager_branch_access$$, 0, 'manager branch access');
select test_rls.assert_denied('RLS-MBA-004A', 'Privilege Escalation', $$insert into public.manager_branch_access (profile_id, branch_id) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002')$$, 'INSERT', 'Tokyo branch access');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_count('RLS-PR-004', 'Critical', $$select * from public.profiles where id in ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002')$$, 2, 'Nagoya worker profiles');
select test_rls.assert_count('RLS-PR-005', 'IDOR', $$select * from public.profiles where id = 'a0000000-0000-0000-0000-000000000003'$$, 0, 'Worker C profile');
select test_rls.assert_denied('RLS-PR-007', 'Privilege Escalation', $$update public.profiles set account_type = 'system_admin' where id = 'a0000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'Worker A account_type');
select test_rls.assert_count('RLS-MBA-001', 'Critical', $$select * from public.manager_branch_access where profile_id = 'a0000000-0000-0000-0000-000000000004' and branch_id = 'b0000000-0000-0000-0000-000000000001'$$, 1, 'own Nagoya access');
select test_rls.assert_count('RLS-MBA-002', 'IDOR', $$select * from public.manager_branch_access where profile_id = 'a0000000-0000-0000-0000-000000000005'$$, 0, 'other access');
select test_rls.assert_denied('RLS-MBA-004', 'Privilege Escalation', $$insert into public.manager_branch_access (profile_id, branch_id) values ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002')$$, 'INSERT', 'Tokyo branch access');

