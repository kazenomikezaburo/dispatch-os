-- Atomically mark an assignment absent or no-show without creating attendance events.

create function public.mark_assignment_absent(
  p_shift_id uuid,
  p_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_assignment_shift_id uuid;
  v_assignment_status text;
  v_branch_id uuid;
begin
  select p.account_type
  into v_account_type
  from public.profiles as p
  where p.id = v_actor_id
    and p.is_active = true;

  if v_account_type is null
    or v_account_type not in ('manager', 'system_admin') then
    raise exception using errcode = '42501', message = 'assignment_absence_forbidden';
  end if;

  select a.shift_slot_id, a.status
  into v_assignment_shift_id, v_assignment_status
  from public.assignments as a
  where a.id = p_assignment_id
  for update of a;

  if not found or v_assignment_shift_id <> p_shift_id then
    raise exception using errcode = 'P0002', message = 'assignment_not_found';
  end if;

  select pr.branch_id
  into v_branch_id
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as pr on pr.id = j.project_id
  where ss.id = p_shift_id;

  if not found or not private.has_branch_access(v_branch_id) then
    raise exception using errcode = '42501', message = 'assignment_absence_forbidden';
  end if;

  if v_assignment_status not in ('assigned', 'confirmed') then
    raise exception using errcode = '22023', message = 'assignment_absence_invalid_state';
  end if;

  if exists (
    select 1
    from public.attendance_events as e
    where e.assignment_id = p_assignment_id
      and e.event_type = 'start_work'
  ) then
    raise exception using errcode = '23514', message = 'assignment_already_started';
  end if;

  update public.assignments
  set status = 'absent'
  where id = p_assignment_id;

  return p_assignment_id;
end;
$$;

create function public.mark_assignment_no_show(
  p_shift_id uuid,
  p_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_assignment_shift_id uuid;
  v_assignment_status text;
  v_branch_id uuid;
  v_starts_at timestamptz;
  v_checked_at timestamptz;
begin
  select p.account_type
  into v_account_type
  from public.profiles as p
  where p.id = v_actor_id
    and p.is_active = true;

  if v_account_type is null
    or v_account_type not in ('manager', 'system_admin') then
    raise exception using errcode = '42501', message = 'assignment_absence_forbidden';
  end if;

  select a.shift_slot_id, a.status
  into v_assignment_shift_id, v_assignment_status
  from public.assignments as a
  where a.id = p_assignment_id
  for update of a;

  if not found or v_assignment_shift_id <> p_shift_id then
    raise exception using errcode = 'P0002', message = 'assignment_not_found';
  end if;

  select pr.branch_id, ss.starts_at
  into v_branch_id, v_starts_at
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as pr on pr.id = j.project_id
  where ss.id = p_shift_id;

  if not found or not private.has_branch_access(v_branch_id) then
    raise exception using errcode = '42501', message = 'assignment_absence_forbidden';
  end if;

  if v_assignment_status not in ('assigned', 'confirmed') then
    raise exception using errcode = '22023', message = 'assignment_absence_invalid_state';
  end if;

  if exists (
    select 1
    from public.attendance_events as e
    where e.assignment_id = p_assignment_id
      and e.event_type = 'start_work'
  ) then
    raise exception using errcode = '23514', message = 'assignment_already_started';
  end if;

  v_checked_at := clock_timestamp();
  if v_checked_at < v_starts_at then
    raise exception using errcode = '23514', message = 'assignment_no_show_too_early';
  end if;

  update public.assignments
  set status = 'no_show'
  where id = p_assignment_id;

  return p_assignment_id;
end;
$$;

alter function public.mark_assignment_absent(uuid, uuid) owner to postgres;
alter function public.mark_assignment_no_show(uuid, uuid) owner to postgres;

revoke all on function public.mark_assignment_absent(uuid, uuid) from public;
revoke all on function public.mark_assignment_absent(uuid, uuid) from anon;
grant execute on function public.mark_assignment_absent(uuid, uuid) to authenticated;

revoke all on function public.mark_assignment_no_show(uuid, uuid) from public;
revoke all on function public.mark_assignment_no_show(uuid, uuid) from anon;
grant execute on function public.mark_assignment_no_show(uuid, uuid) to authenticated;
