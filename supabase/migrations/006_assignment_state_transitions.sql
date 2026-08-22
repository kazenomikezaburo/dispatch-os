-- Atomically cancel an active assignment before its shift starts.

create function public.cancel_assignment_by_company(
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
  v_branch_id uuid;
  v_starts_at timestamptz;
  v_assignment_shift_id uuid;
  v_assignment_status text;
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

  select pr.branch_id, ss.starts_at
  into v_branch_id, v_starts_at
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as pr on pr.id = j.project_id
  where ss.id = p_shift_id;

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

  select a.shift_slot_id, a.status
  into v_assignment_shift_id, v_assignment_status
  from public.assignments as a
  where a.id = p_assignment_id
  for update of a;

  if not found
    or v_assignment_shift_id <> p_shift_id then
    raise exception using
      errcode = 'P0002',
      message = 'assignment_not_found';
  end if;

  if v_assignment_status not in ('assigned', 'confirmed') then
    raise exception using
      errcode = '22023',
      message = 'assignment_not_cancellable';
  end if;

  if now() >= v_starts_at then
    raise exception using
      errcode = '22023',
      message = 'assignment_already_started';
  end if;

  update public.assignments
  set status = 'cancelled_by_company',
      cancelled_at = now()
  where id = p_assignment_id;

  return p_assignment_id;
end;
$$;

alter function public.cancel_assignment_by_company(uuid, uuid)
  owner to postgres;

revoke all on function public.cancel_assignment_by_company(uuid, uuid)
  from public;
revoke all on function public.cancel_assignment_by_company(uuid, uuid)
  from anon;
grant execute on function public.cancel_assignment_by_company(uuid, uuid)
  to authenticated;
