-- 派遣業務OS RLS policies
-- RLS is already enabled on all 14 tables by 001_initial_schema.sql.

create schema private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create function private.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and account_type = 'system_admin'
      and is_active = true
  );
$$;

create function private.current_worker_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.workers
  where auth_profile_id = (select auth.uid())
    and status = 'active';
$$;

create function private.has_branch_access(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_system_admin()
    or exists (
      select 1
      from public.manager_branch_access
      where profile_id = (select auth.uid())
        and branch_id = target_branch_id
    );
$$;

create function private.worker_can_view_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_worker as (
    select id, branch_id
    from public.workers
    where id = private.current_worker_id()
  )
  select exists (
    select 1
    from public.projects p
    cross join current_worker w
    where p.id = target_project_id
      and (
        (p.status = 'recruiting' and p.branch_id = w.branch_id)
        or exists (
          select 1
          from public.jobs j
          join public.shift_slots ss on ss.job_id = j.id
          join public.shift_applications sa on sa.shift_slot_id = ss.id
          where j.project_id = p.id
            and sa.worker_id = w.id
        )
        or exists (
          select 1
          from public.jobs j
          join public.shift_slots ss on ss.job_id = j.id
          join public.assignments a on a.shift_slot_id = ss.id
          where j.project_id = p.id
            and a.worker_id = w.id
        )
      )
  );
$$;

create function private.worker_can_view_workplace(target_workplace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_worker as (
    select id, branch_id
    from public.workers
    where id = private.current_worker_id()
  )
  select exists (
    select 1
    from public.jobs j
    join public.projects p on p.id = j.project_id
    cross join current_worker w
    where j.workplace_id = target_workplace_id
      and (
        (p.status = 'recruiting' and p.branch_id = w.branch_id)
        or exists (
          select 1
          from public.shift_slots ss
          join public.shift_applications sa on sa.shift_slot_id = ss.id
          where ss.job_id = j.id
            and sa.worker_id = w.id
        )
        or exists (
          select 1
          from public.shift_slots ss
          join public.assignments a on a.shift_slot_id = ss.id
          where ss.job_id = j.id
            and a.worker_id = w.id
        )
      )
  );
$$;

create function private.worker_can_view_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_worker as (
    select id, branch_id
    from public.workers
    where id = private.current_worker_id()
  )
  select exists (
    select 1
    from public.jobs j
    join public.projects p on p.id = j.project_id
    cross join current_worker w
    where j.id = target_job_id
      and (
        (p.status = 'recruiting' and p.branch_id = w.branch_id)
        or exists (
          select 1
          from public.shift_slots ss
          join public.shift_applications sa on sa.shift_slot_id = ss.id
          where ss.job_id = j.id
            and sa.worker_id = w.id
        )
        or exists (
          select 1
          from public.shift_slots ss
          join public.assignments a on a.shift_slot_id = ss.id
          where ss.job_id = j.id
            and a.worker_id = w.id
        )
      )
  );
$$;

create function private.worker_can_view_shift_slot(target_shift_slot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_worker as (
    select id, branch_id
    from public.workers
    where id = private.current_worker_id()
  )
  select exists (
    select 1
    from public.shift_slots ss
    join public.jobs j on j.id = ss.job_id
    join public.projects p on p.id = j.project_id
    cross join current_worker w
    where ss.id = target_shift_slot_id
      and (
        (p.status = 'recruiting' and p.branch_id = w.branch_id)
        or exists (
          select 1
          from public.shift_applications sa
          where sa.shift_slot_id = ss.id
            and sa.worker_id = w.id
        )
        or exists (
          select 1
          from public.assignments a
          where a.shift_slot_id = ss.id
            and a.worker_id = w.id
        )
      )
  );
$$;

create function private.worker_can_apply_to_shift_slot(target_shift_slot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shift_slots ss
    join public.jobs j on j.id = ss.job_id
    join public.projects p on p.id = j.project_id
    join public.workers w on w.id = private.current_worker_id()
    where ss.id = target_shift_slot_id
      and ss.status = 'recruiting'
      and p.status = 'recruiting'
      and p.branch_id = w.branch_id
  );
$$;

create function private.worker_owns_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = target_assignment_id
      and a.worker_id = private.current_worker_id()
  );
$$;

create function private.worker_can_confirm_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    join public.shift_slots ss on ss.id = a.shift_slot_id
    where a.id = target_assignment_id
      and a.worker_id = private.current_worker_id()
      and ss.starts_at > now()
  );
$$;

create function private.has_job_branch_access(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs j
    join public.projects p on p.id = j.project_id
    where j.id = target_job_id
      and private.has_branch_access(p.branch_id)
  );
$$;

create function private.has_project_branch_access(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and private.has_branch_access(p.branch_id)
  );
$$;

create function private.has_shift_slot_branch_access(target_shift_slot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shift_slots ss
    join public.jobs j on j.id = ss.job_id
    join public.projects p on p.id = j.project_id
    where ss.id = target_shift_slot_id
      and private.has_branch_access(p.branch_id)
  );
$$;

create function private.has_assignment_branch_access(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    join public.shift_slots ss on ss.id = a.shift_slot_id
    join public.jobs j on j.id = ss.job_id
    join public.projects p on p.id = j.project_id
    where a.id = target_assignment_id
      and private.has_branch_access(p.branch_id)
  );
$$;

revoke all on function private.is_system_admin() from public;
revoke all on function private.is_system_admin() from anon;
revoke all on function private.current_worker_id() from public;
revoke all on function private.current_worker_id() from anon;
revoke all on function private.has_branch_access(uuid) from public;
revoke all on function private.has_branch_access(uuid) from anon;
revoke all on function private.worker_can_view_project(uuid) from public;
revoke all on function private.worker_can_view_project(uuid) from anon;
revoke all on function private.worker_can_view_workplace(uuid) from public;
revoke all on function private.worker_can_view_workplace(uuid) from anon;
revoke all on function private.worker_can_view_job(uuid) from public;
revoke all on function private.worker_can_view_job(uuid) from anon;
revoke all on function private.worker_can_view_shift_slot(uuid) from public;
revoke all on function private.worker_can_view_shift_slot(uuid) from anon;
revoke all on function private.worker_can_apply_to_shift_slot(uuid) from public;
revoke all on function private.worker_can_apply_to_shift_slot(uuid) from anon;
revoke all on function private.worker_owns_assignment(uuid) from public;
revoke all on function private.worker_owns_assignment(uuid) from anon;
revoke all on function private.worker_can_confirm_assignment(uuid) from public;
revoke all on function private.worker_can_confirm_assignment(uuid) from anon;
revoke all on function private.has_job_branch_access(uuid) from public;
revoke all on function private.has_job_branch_access(uuid) from anon;
revoke all on function private.has_project_branch_access(uuid) from public;
revoke all on function private.has_project_branch_access(uuid) from anon;
revoke all on function private.has_shift_slot_branch_access(uuid) from public;
revoke all on function private.has_shift_slot_branch_access(uuid) from anon;
revoke all on function private.has_assignment_branch_access(uuid) from public;
revoke all on function private.has_assignment_branch_access(uuid) from anon;

grant execute on function private.is_system_admin() to authenticated;
grant execute on function private.current_worker_id() to authenticated;
grant execute on function private.has_branch_access(uuid) to authenticated;
grant execute on function private.worker_can_view_project(uuid) to authenticated;
grant execute on function private.worker_can_view_workplace(uuid) to authenticated;
grant execute on function private.worker_can_view_job(uuid) to authenticated;
grant execute on function private.worker_can_view_shift_slot(uuid) to authenticated;
grant execute on function private.worker_can_apply_to_shift_slot(uuid) to authenticated;
grant execute on function private.worker_owns_assignment(uuid) to authenticated;
grant execute on function private.worker_can_confirm_assignment(uuid) to authenticated;
grant execute on function private.has_job_branch_access(uuid) to authenticated;
grant execute on function private.has_project_branch_access(uuid) to authenticated;
grant execute on function private.has_shift_slot_branch_access(uuid) to authenticated;
grant execute on function private.has_assignment_branch_access(uuid) to authenticated;

-- 01 branches
create policy "Workers can view their branch"
on public.branches for select to authenticated
using (
  exists (
    select 1 from public.workers
    where auth_profile_id = (select auth.uid())
      and status = 'active'
      and branch_id = branches.id
  )
);

create policy "Managers can view accessible branches"
on public.branches for select to authenticated
using (private.has_branch_access(id));

create policy "System admins can view all branches"
on public.branches for select to authenticated
using (private.is_system_admin());

create policy "System admins can create branches"
on public.branches for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update branches"
on public.branches for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 02 profiles
create policy "Workers can view own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Managers can view accessible profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.workers
    where auth_profile_id = profiles.id
      and private.has_branch_access(branch_id)
  )
);

create policy "System admins can view all profiles"
on public.profiles for select to authenticated
using (private.is_system_admin());

create policy "System admins can update profiles"
on public.profiles for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 03 manager_branch_access
create policy "Managers can view own branch access"
on public.manager_branch_access for select to authenticated
using (profile_id = (select auth.uid()));

create policy "System admins can view all branch access"
on public.manager_branch_access for select to authenticated
using (private.is_system_admin());

create policy "System admins can create branch access"
on public.manager_branch_access for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update branch access"
on public.manager_branch_access for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 04 workers
create policy "Workers can view own worker record"
on public.workers for select to authenticated
using (auth_profile_id = (select auth.uid()));

create policy "Managers can view branch workers"
on public.workers for select to authenticated
using (private.has_branch_access(branch_id));

create policy "System admins can view all workers"
on public.workers for select to authenticated
using (private.is_system_admin());

create policy "System admins can create workers"
on public.workers for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update workers"
on public.workers for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 05 clients
create policy "Managers can view branch clients"
on public.clients for select to authenticated
using (private.has_branch_access(branch_id));

create policy "Managers can create branch clients"
on public.clients for insert to authenticated
with check (private.has_branch_access(branch_id));

create policy "Managers can update branch clients"
on public.clients for update to authenticated
using (private.has_branch_access(branch_id))
with check (private.has_branch_access(branch_id));

create policy "System admins can view all clients"
on public.clients for select to authenticated
using (private.is_system_admin());

create policy "System admins can create clients"
on public.clients for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update clients"
on public.clients for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- Reusable relationship checks below intentionally follow the v1 foreign keys.

-- 06 projects
create policy "Workers can view available projects"
on public.projects for select to authenticated
using (private.worker_can_view_project(id));

create policy "Managers can view branch projects"
on public.projects for select to authenticated
using (private.has_branch_access(branch_id));

create policy "Managers can create branch projects"
on public.projects for insert to authenticated
with check (private.has_branch_access(branch_id));

create policy "Managers can update branch projects"
on public.projects for update to authenticated
using (private.has_branch_access(branch_id))
with check (private.has_branch_access(branch_id));

create policy "System admins can view all projects"
on public.projects for select to authenticated
using (private.is_system_admin());

create policy "System admins can create projects"
on public.projects for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update projects"
on public.projects for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 07 workplaces
create policy "Workers can view available workplaces"
on public.workplaces for select to authenticated
using (private.worker_can_view_workplace(id));

create policy "Managers can view branch workplaces"
on public.workplaces for select to authenticated
using (private.has_branch_access(branch_id));

create policy "Managers can create branch workplaces"
on public.workplaces for insert to authenticated
with check (private.has_branch_access(branch_id));

create policy "Managers can update branch workplaces"
on public.workplaces for update to authenticated
using (private.has_branch_access(branch_id))
with check (private.has_branch_access(branch_id));

create policy "System admins can view all workplaces"
on public.workplaces for select to authenticated
using (private.is_system_admin());

create policy "System admins can create workplaces"
on public.workplaces for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update workplaces"
on public.workplaces for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 08 jobs
create policy "Workers can view available jobs"
on public.jobs for select to authenticated
using (private.worker_can_view_job(id));

create policy "Managers can view branch jobs"
on public.jobs for select to authenticated
using (private.has_job_branch_access(id));

create policy "Managers can create branch jobs"
on public.jobs for insert to authenticated
with check (private.has_project_branch_access(project_id));

create policy "Managers can update branch jobs"
on public.jobs for update to authenticated
using (private.has_job_branch_access(id))
with check (private.has_project_branch_access(project_id));

create policy "System admins can view all jobs"
on public.jobs for select to authenticated
using (private.is_system_admin());

create policy "System admins can create jobs"
on public.jobs for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update jobs"
on public.jobs for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 09 shift_slots
create policy "Workers can view available shift slots"
on public.shift_slots for select to authenticated
using (private.worker_can_view_shift_slot(id));

create policy "Managers can view branch shift slots"
on public.shift_slots for select to authenticated
using (private.has_shift_slot_branch_access(id));

create policy "Managers can create branch shift slots"
on public.shift_slots for insert to authenticated
with check (private.has_job_branch_access(job_id));

create policy "Managers can update branch shift slots"
on public.shift_slots for update to authenticated
using (private.has_shift_slot_branch_access(id))
with check (private.has_job_branch_access(job_id));

create policy "System admins can view all shift slots"
on public.shift_slots for select to authenticated
using (private.is_system_admin());

create policy "System admins can create shift slots"
on public.shift_slots for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update shift slots"
on public.shift_slots for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 10 shift_applications
create policy "Workers can view own shift applications"
on public.shift_applications for select to authenticated
using (worker_id = private.current_worker_id());

create policy "Workers can create own shift applications"
on public.shift_applications for insert to authenticated
with check (
  worker_id = private.current_worker_id()
  and status = 'applied'
  and private.worker_can_apply_to_shift_slot(shift_slot_id)
);

create policy "Managers can view branch shift applications"
on public.shift_applications for select to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id));

create policy "Managers can update branch shift applications"
on public.shift_applications for update to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id))
with check (private.has_shift_slot_branch_access(shift_slot_id));

create policy "System admins can view all shift applications"
on public.shift_applications for select to authenticated
using (private.is_system_admin());

create policy "System admins can update shift applications"
on public.shift_applications for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 11 assignments
create policy "Workers can view own assignments"
on public.assignments for select to authenticated
using (worker_id = private.current_worker_id());

create policy "Managers can view branch assignments"
on public.assignments for select to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id));

create policy "Managers can create branch assignments"
on public.assignments for insert to authenticated
with check (private.has_shift_slot_branch_access(shift_slot_id));

create policy "Managers can update branch assignments"
on public.assignments for update to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id))
with check (private.has_shift_slot_branch_access(shift_slot_id));

create policy "System admins can view all assignments"
on public.assignments for select to authenticated
using (private.is_system_admin());

create policy "System admins can create assignments"
on public.assignments for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update assignments"
on public.assignments for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 12 pre_shift_confirmations
create policy "Workers can view own pre shift confirmations"
on public.pre_shift_confirmations for select to authenticated
using (private.worker_owns_assignment(assignment_id));

create policy "Workers can create own pre shift confirmations"
on public.pre_shift_confirmations for insert to authenticated
with check (private.worker_can_confirm_assignment(assignment_id));

create policy "Workers can update own pre shift confirmations"
on public.pre_shift_confirmations for update to authenticated
using (private.worker_can_confirm_assignment(assignment_id))
with check (private.worker_can_confirm_assignment(assignment_id));

create policy "Managers can view branch pre shift confirmations"
on public.pre_shift_confirmations for select to authenticated
using (private.has_assignment_branch_access(assignment_id));

create policy "Managers can update branch pre shift confirmations"
on public.pre_shift_confirmations for update to authenticated
using (private.has_assignment_branch_access(assignment_id))
with check (private.has_assignment_branch_access(assignment_id));

create policy "System admins can view all pre shift confirmations"
on public.pre_shift_confirmations for select to authenticated
using (private.is_system_admin());

create policy "System admins can create pre shift confirmations"
on public.pre_shift_confirmations for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update pre shift confirmations"
on public.pre_shift_confirmations for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());

-- 13 attendance_events
create policy "Workers can view own attendance events"
on public.attendance_events for select to authenticated
using (private.worker_owns_assignment(assignment_id));

create policy "Workers can create own attendance events"
on public.attendance_events for insert to authenticated
with check (
  source = 'worker'
  and private.worker_owns_assignment(assignment_id)
);

create policy "Managers can view branch attendance events"
on public.attendance_events for select to authenticated
using (private.has_assignment_branch_access(assignment_id));

create policy "Managers can create branch attendance events"
on public.attendance_events for insert to authenticated
with check (
  source = 'manager'
  and private.has_assignment_branch_access(assignment_id)
);

create policy "System admins can view all attendance events"
on public.attendance_events for select to authenticated
using (private.is_system_admin());

create policy "System admins can create attendance events"
on public.attendance_events for insert to authenticated
with check (
  private.is_system_admin()
  and source = 'manager'
);

-- 14 attendance_records
create policy "Workers can view own attendance records"
on public.attendance_records for select to authenticated
using (private.worker_owns_assignment(assignment_id));

create policy "Managers can view branch attendance records"
on public.attendance_records for select to authenticated
using (private.has_assignment_branch_access(assignment_id));

create policy "Managers can create branch attendance records"
on public.attendance_records for insert to authenticated
with check (private.has_assignment_branch_access(assignment_id));

create policy "Managers can update branch attendance records"
on public.attendance_records for update to authenticated
using (private.has_assignment_branch_access(assignment_id))
with check (private.has_assignment_branch_access(assignment_id));

create policy "System admins can view all attendance records"
on public.attendance_records for select to authenticated
using (private.is_system_admin());

create policy "System admins can create attendance records"
on public.attendance_records for insert to authenticated
with check (private.is_system_admin());

create policy "System admins can update attendance records"
on public.attendance_records for update to authenticated
using (private.is_system_admin())
with check (private.is_system_admin());
