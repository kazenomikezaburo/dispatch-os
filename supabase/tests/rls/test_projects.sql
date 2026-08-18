reset role; set role authenticated;
select test_rls.set_actor('Worker A', 'a0000000-0000-0000-0000-000000000001');
select test_rls.assert_count('RLS-CL-001', 'Critical', $$select * from public.clients$$, 0, 'clients');
select test_rls.assert_count('RLS-PJ-001', 'Critical', $$select * from public.projects where id = 'e0000000-0000-0000-0000-000000000001'$$, 1, 'Project N1');
select test_rls.assert_count('RLS-PJ-002', 'IDOR', $$select * from public.projects where id = 'e0000000-0000-0000-0000-000000000003'$$, 0, 'Project T1');
select test_rls.assert_count('RLS-PJ-003', 'Critical', $$select * from public.projects where id = 'e0000000-0000-0000-0000-000000000002'$$, 1, 'closed Project N2');

reset role; set role authenticated;
select test_rls.set_actor('Worker B', 'a0000000-0000-0000-0000-000000000002');
select test_rls.assert_count('RLS-PJ-004', 'IDOR', $$select * from public.projects where id = 'e0000000-0000-0000-0000-000000000002'$$, 0, 'closed Project N2');

reset role; set role authenticated;
select test_rls.set_actor('Manager A', 'a0000000-0000-0000-0000-000000000004');
select test_rls.assert_count('RLS-CL-002', 'Critical', $$select * from public.clients where id = 'd0000000-0000-0000-0000-000000000001'$$, 1, 'Nagoya client');
select test_rls.assert_count('RLS-CL-003', 'IDOR', $$select * from public.clients where id = 'd0000000-0000-0000-0000-000000000002'$$, 0, 'Tokyo client');
select test_rls.assert_denied('RLS-CL-004', 'IDOR', $$insert into public.clients (id, branch_id, name) values ('d0000000-0000-0000-0000-000000000099','b0000000-0000-0000-0000-000000000002','TEST forbidden')$$, 'INSERT', 'Tokyo client');
select test_rls.assert_denied('RLS-CL-005', 'IDOR', $$update public.clients set branch_id = 'b0000000-0000-0000-0000-000000000002' where id = 'd0000000-0000-0000-0000-000000000001'$$, 'UPDATE', 'Nagoya client to Tokyo');
select test_rls.assert_count('RLS-PJ-005', 'Critical', $$select * from public.projects where branch_id = 'b0000000-0000-0000-0000-000000000001'$$, 3, 'Nagoya projects');
select test_rls.assert_count('RLS-PJ-006', 'IDOR', $$select * from public.projects where id = 'e0000000-0000-0000-0000-000000000003'$$, 0, 'Project T1');
select test_rls.assert_denied('RLS-PJ-007', 'IDOR', $$update public.projects set name = 'TEST changed' where id = 'e0000000-0000-0000-0000-000000000003'$$, 'UPDATE', 'Project T1');

