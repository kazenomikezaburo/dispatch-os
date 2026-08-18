-- Supabase Data API table-level privileges.
-- Row-level authorization remains the responsibility of RLS policies in 002.

revoke all privileges on table public.branches from anon;
revoke all privileges on table public.branches from authenticated;
grant select, insert, update on table public.branches to authenticated;

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;

revoke all privileges on table public.manager_branch_access from anon;
revoke all privileges on table public.manager_branch_access from authenticated;
grant select, insert, update on table public.manager_branch_access to authenticated;

revoke all privileges on table public.workers from anon;
revoke all privileges on table public.workers from authenticated;
grant select, insert, update on table public.workers to authenticated;

revoke all privileges on table public.clients from anon;
revoke all privileges on table public.clients from authenticated;
grant select, insert, update on table public.clients to authenticated;

revoke all privileges on table public.projects from anon;
revoke all privileges on table public.projects from authenticated;
grant select, insert, update on table public.projects to authenticated;

revoke all privileges on table public.workplaces from anon;
revoke all privileges on table public.workplaces from authenticated;
grant select, insert, update on table public.workplaces to authenticated;

revoke all privileges on table public.jobs from anon;
revoke all privileges on table public.jobs from authenticated;
grant select, insert, update on table public.jobs to authenticated;

revoke all privileges on table public.shift_slots from anon;
revoke all privileges on table public.shift_slots from authenticated;
grant select, insert, update on table public.shift_slots to authenticated;

revoke all privileges on table public.shift_applications from anon;
revoke all privileges on table public.shift_applications from authenticated;
grant select, insert, update on table public.shift_applications to authenticated;

revoke all privileges on table public.assignments from anon;
revoke all privileges on table public.assignments from authenticated;
grant select, insert, update on table public.assignments to authenticated;

revoke all privileges on table public.pre_shift_confirmations from anon;
revoke all privileges on table public.pre_shift_confirmations from authenticated;
grant select, insert, update on table public.pre_shift_confirmations to authenticated;

revoke all privileges on table public.attendance_events from anon;
revoke all privileges on table public.attendance_events from authenticated;
grant select, insert on table public.attendance_events to authenticated;

revoke all privileges on table public.attendance_records from anon;
revoke all privileges on table public.attendance_records from authenticated;
grant select, insert, update on table public.attendance_records to authenticated;
