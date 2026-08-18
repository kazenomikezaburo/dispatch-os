\set ON_ERROR_STOP on

\echo 'Preparing RLS test harness...'
\ir rls/setup.sql
\ir rls/helpers.sql

\echo 'Running RLS tests...'
\ir rls/test_branches.sql
\ir rls/test_profiles.sql
\ir rls/test_workers.sql
\ir rls/test_projects.sql
\ir rls/test_hierarchy.sql
\ir rls/test_shift_applications.sql
\ir rls/test_assignments.sql
\ir rls/test_pre_shift_confirmations.sql
\ir rls/test_attendance_events.sql
\ir rls/test_attendance_records.sql
\ir rls/test_anon.sql
\ir rls/test_privilege_escalation.sql
\ir rls/test_idor.sql

reset role;

\echo 'Detailed results:'
select
  test_id as "Test ID",
  actor as "Actor",
  action as "Action",
  target as "Target",
  expected as "Expected",
  actual as "Actual",
  case when passed then 'PASS' else 'FAIL' end as "Result"
from test_rls.results
order by sequence_id;

\echo 'RLS TEST RESULT'
select 'Total' as "Metric", count(*)::text as "Result" from test_rls.results
union all
select 'Passed', count(*)::text from test_rls.results where passed
union all
select 'Failed', count(*)::text from test_rls.results where not passed
union all
select category, case when bool_and(passed) then 'PASS' else 'FAIL' end
from test_rls.results
group by category
order by 1;

do $$
declare
  failure_count bigint;
begin
  select count(*) into failure_count
  from test_rls.results
  where not passed;

  if failure_count > 0 then
    raise exception 'RLS test suite failed: % failure(s)', failure_count;
  end if;
end;
$$;

drop schema test_rls cascade;
\echo 'RLS test suite passed.'

