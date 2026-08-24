-- Keep cancelled assignments as history while enforcing active assignment integrity.

do $$
begin
  if exists (
    select 1
    from public.assignments
    where status in ('assigned', 'confirmed', 'completed')
    group by shift_slot_id, worker_id
    having count(*) > 1
  ) then
    raise exception
      'Cannot replace assignments_slot_worker_key: duplicate active assignments exist';
  end if;
end;
$$;

alter table public.assignments
  drop constraint assignments_slot_worker_key;

create unique index assignments_active_shift_worker_unique
  on public.assignments(shift_slot_id, worker_id)
  where status in ('assigned', 'confirmed', 'completed');

-- Assignment creation is restricted to the validated RPC below.
drop policy "Managers can create branch assignments"
on public.assignments;

drop policy "System admins can create assignments"
on public.assignments;

create function public.create_assignment_from_application(
  p_shift_id uuid,
  p_application_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_branch_id uuid;
  v_required_workers smallint;
  v_worker_id uuid;
  v_application_status text;
  v_active_count integer;
  v_assignment_id uuid;
begin
  select p.account_type
  into v_account_type
  from public.profiles as p
  where p.id = v_actor_id
    and p.is_active = true;

  if v_account_type is null
    or v_account_type not in ('manager', 'system_admin') then
    raise exception using
      errcode = '42501',
      message = 'assignment_forbidden';
  end if;

  select pr.branch_id, ss.required_workers
  into v_branch_id, v_required_workers
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as pr on pr.id = j.project_id
  where ss.id = p_shift_id
  for update of ss;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'shift_not_found';
  end if;

  if not private.has_branch_access(v_branch_id) then
    raise exception using
      errcode = '42501',
      message = 'assignment_forbidden';
  end if;

  select sa.worker_id, sa.status
  into v_worker_id, v_application_status
  from public.shift_applications as sa
  where sa.id = p_application_id
    and sa.shift_slot_id = p_shift_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'application_not_found';
  end if;

  if v_application_status <> 'accepted' then
    raise exception using
      errcode = '22023',
      message = 'application_not_accepted';
  end if;

  if exists (
    select 1
    from public.assignments as a
    where a.shift_slot_id = p_shift_id
      and a.worker_id = v_worker_id
      and a.status in ('assigned', 'confirmed', 'completed')
  ) then
    raise exception using
      errcode = '23505',
      message = 'worker_already_assigned';
  end if;

  select count(*)
  into v_active_count
  from public.assignments as a
  where a.shift_slot_id = p_shift_id
    and a.status in ('assigned', 'confirmed', 'completed');

  if v_active_count >= v_required_workers then
    raise exception using
      errcode = '23514',
      message = 'shift_capacity_reached';
  end if;

  insert into public.assignments (
    shift_slot_id,
    worker_id,
    source,
    status,
    assigned_by
  )
  values (
    p_shift_id,
    v_worker_id,
    'application',
    'assigned',
    v_actor_id
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

alter function public.create_assignment_from_application(uuid, uuid)
  owner to postgres;

revoke all on function public.create_assignment_from_application(uuid, uuid)
  from public;
revoke all on function public.create_assignment_from_application(uuid, uuid)
  from anon;
grant execute on function public.create_assignment_from_application(uuid, uuid)
  to authenticated;
