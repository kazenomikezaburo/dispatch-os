-- Local test harness. Run only after migrations and supabase/seed.sql.
reset role;
drop schema if exists test_rls cascade;
create schema test_rls;

create table test_rls.results (
  sequence_id bigint generated always as identity primary key,
  test_id text not null unique,
  category text not null,
  actor text not null,
  action text not null,
  target text not null,
  expected text not null,
  actual text not null,
  passed boolean not null
);

-- Test RLS itself, not a preceding table-level permission failure. These
-- grants exist only in the disposable local/test database and do not add any
-- policy or bypass RLS.
grant select, insert, update, delete on table
  public.branches,
  public.profiles,
  public.manager_branch_access,
  public.workers,
  public.clients,
  public.projects,
  public.workplaces,
  public.jobs,
  public.shift_slots,
  public.shift_applications,
  public.assignments,
  public.pre_shift_confirmations,
  public.attendance_events,
  public.attendance_records
to authenticated, anon;

grant usage on schema test_rls to authenticated, anon;
grant insert on test_rls.results to authenticated, anon;
grant usage, select on sequence test_rls.results_sequence_id_seq to authenticated, anon;
