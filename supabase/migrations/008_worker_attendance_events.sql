-- Worker attendance events are written through narrow, concurrency-safe RPCs.

create unique index attendance_events_one_start_work_per_assignment
on public.attendance_events (assignment_id)
where event_type = 'start_work';

create unique index attendance_events_one_end_work_per_assignment
on public.attendance_events (assignment_id)
where event_type = 'end_work';

create function public.record_worker_start_work(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid;
  v_assignment_worker_id uuid;
  v_assignment_status text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_recorded_at timestamptz;
  v_event_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'attendance_not_authenticated';
  end if;

  select w.id
  into v_worker_id
  from public.workers as w
  where w.auth_profile_id = v_actor_id
    and w.status = 'active';

  if v_worker_id is null then
    raise exception using errcode = '42501', message = 'attendance_worker_required';
  end if;

  select a.worker_id, a.status, s.starts_at, s.ends_at
  into v_assignment_worker_id, v_assignment_status, v_starts_at, v_ends_at
  from public.assignments as a
  join public.shift_slots as s on s.id = a.shift_slot_id
  where a.id = p_assignment_id
  for update of a;

  if not found or v_assignment_worker_id <> v_worker_id then
    raise exception using errcode = '42501', message = 'attendance_assignment_forbidden';
  end if;

  if v_assignment_status not in ('assigned', 'confirmed') then
    raise exception using errcode = '23514', message = 'attendance_assignment_inactive';
  end if;

  v_recorded_at := clock_timestamp();
  if v_recorded_at < v_starts_at - interval '60 minutes'
     or v_recorded_at >= v_ends_at then
    raise exception using errcode = '23514', message = 'attendance_start_not_open';
  end if;

  if exists (
    select 1
    from public.attendance_events as e
    where e.assignment_id = p_assignment_id
      and e.event_type = 'start_work'
  ) then
    raise exception using errcode = '23505', message = 'attendance_start_already_recorded';
  end if;

  if exists (
    select 1
    from public.attendance_events as e
    where e.assignment_id = p_assignment_id
      and e.event_type = 'end_work'
  ) then
    raise exception using errcode = '23514', message = 'attendance_event_order_invalid';
  end if;

  insert into public.attendance_events (
    assignment_id,
    event_type,
    server_received_at,
    source
  ) values (
    p_assignment_id,
    'start_work',
    v_recorded_at,
    'worker'
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create function public.record_worker_end_work(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid;
  v_assignment_worker_id uuid;
  v_assignment_status text;
  v_start_at timestamptz;
  v_recorded_at timestamptz;
  v_event_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'attendance_not_authenticated';
  end if;

  select w.id
  into v_worker_id
  from public.workers as w
  where w.auth_profile_id = v_actor_id
    and w.status = 'active';

  if v_worker_id is null then
    raise exception using errcode = '42501', message = 'attendance_worker_required';
  end if;

  select a.worker_id, a.status
  into v_assignment_worker_id, v_assignment_status
  from public.assignments as a
  where a.id = p_assignment_id
  for update;

  if not found or v_assignment_worker_id <> v_worker_id then
    raise exception using errcode = '42501', message = 'attendance_assignment_forbidden';
  end if;

  if v_assignment_status not in ('assigned', 'confirmed') then
    raise exception using errcode = '23514', message = 'attendance_assignment_inactive';
  end if;

  select e.server_received_at
  into v_start_at
  from public.attendance_events as e
  where e.assignment_id = p_assignment_id
    and e.event_type = 'start_work';

  if v_start_at is null then
    raise exception using errcode = '23514', message = 'attendance_start_missing';
  end if;

  if exists (
    select 1
    from public.attendance_events as e
    where e.assignment_id = p_assignment_id
      and e.event_type = 'end_work'
  ) then
    raise exception using errcode = '23505', message = 'attendance_end_already_recorded';
  end if;

  v_recorded_at := clock_timestamp();
  if v_recorded_at < v_start_at then
    raise exception using errcode = '23514', message = 'attendance_event_order_invalid';
  end if;

  insert into public.attendance_events (
    assignment_id,
    event_type,
    server_received_at,
    source
  ) values (
    p_assignment_id,
    'end_work',
    v_recorded_at,
    'worker'
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

drop policy "Workers can create own attendance events"
on public.attendance_events;

revoke all on function public.record_worker_start_work(uuid) from public;
revoke all on function public.record_worker_start_work(uuid) from anon;
grant execute on function public.record_worker_start_work(uuid) to authenticated;

revoke all on function public.record_worker_end_work(uuid) from public;
revoke all on function public.record_worker_end_work(uuid) from anon;
grant execute on function public.record_worker_end_work(uuid) to authenticated;
