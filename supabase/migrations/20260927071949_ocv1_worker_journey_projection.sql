-- OCV1-04B: immutable confirmation scheduling input and bounded Worker-safe journey facts.

drop policy if exists "Workers can create own pre shift confirmations"
  on public.pre_shift_confirmations;
drop policy if exists "Workers can update own pre shift confirmations"
  on public.pre_shift_confirmations;
drop policy if exists "Managers can update branch pre shift confirmations"
  on public.pre_shift_confirmations;
drop policy if exists "System admins can create pre shift confirmations"
  on public.pre_shift_confirmations;
drop policy if exists "System admins can update pre shift confirmations"
  on public.pre_shift_confirmations;

revoke insert, update, delete on table public.pre_shift_confirmations from authenticated;

create function public.submit_own_pre_shift_confirmation(
  p_assignment_id uuid,
  p_can_work boolean,
  p_health_status text,
  p_planned_wake_at timestamptz,
  p_planned_departure_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid;
  v_assignment record;
  v_now timestamptz := clock_timestamp();
  v_open_at timestamptz;
  v_confirmation_id uuid;
begin
  if v_actor_id is null
     or p_assignment_id is null
     or p_can_work is null
     or p_health_status is null
     or p_health_status not in ('good', 'concern', 'unwell') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select w.id
  into v_worker_id
  from public.profiles as p
  join public.workers as w
    on w.auth_profile_id = p.id
   and w.status = 'active'
  where p.id = v_actor_id
    and p.account_type = 'worker'
    and p.is_active = true;

  if v_worker_id is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select a.id, a.status as assignment_status, ss.status as shift_status,
         ss.starts_at, ss.ends_at, coalesce(ss.meeting_at, ss.starts_at) as arrival_target
  into v_assignment
  from public.assignments as a
  join public.shift_slots as ss on ss.id = a.shift_slot_id
  where a.id = p_assignment_id
    and a.worker_id = v_worker_id
  for update of a;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_assignment.assignment_status not in ('assigned', 'confirmed')
     or v_assignment.shift_status = 'cancelled'
     or v_now >= v_assignment.starts_at then
    return jsonb_build_object('ok', false, 'code', 'CLOSED');
  end if;

  v_open_at := (
    pg_catalog.date_trunc('day', v_assignment.starts_at at time zone 'Asia/Tokyo')
    - interval '1 day'
  ) at time zone 'Asia/Tokyo';

  if v_now < v_open_at then
    return jsonb_build_object('ok', false, 'code', 'NOT_OPEN', 'opens_at', v_open_at);
  end if;

  if exists (
    select 1 from public.pre_shift_confirmations as existing
    where existing.assignment_id = p_assignment_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_SUBMITTED');
  end if;

  if (p_planned_wake_at is not null and (p_planned_wake_at <= v_now or p_planned_wake_at > v_assignment.arrival_target))
     or (p_planned_departure_at is not null and (p_planned_departure_at <= v_now or p_planned_departure_at > v_assignment.arrival_target))
     or (p_planned_wake_at is not null and p_planned_departure_at is not null and p_planned_departure_at < p_planned_wake_at) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PLANNED_TIME');
  end if;

  insert into public.pre_shift_confirmations (
    assignment_id,
    can_work,
    health_status,
    planned_wake_at,
    planned_departure_at,
    submitted_at,
    updated_at
  ) values (
    p_assignment_id,
    p_can_work,
    p_health_status,
    p_planned_wake_at,
    p_planned_departure_at,
    v_now,
    v_now
  )
  returning id into v_confirmation_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'SUBMITTED',
    'confirmation_id', v_confirmation_id,
    'submitted_at', v_now
  );
end;
$$;

create function public.get_own_assignment_journey_facts(p_assignment_ids uuid[])
returns table (
  assignment_id uuid,
  shift_id uuid,
  generated_at timestamptz,
  assignment_status text,
  shift_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  arrival_target timestamptz,
  has_confirmation boolean,
  confirmation_submitted_at timestamptz,
  planned_wake_at timestamptz,
  planned_departure_at timestamptz,
  wake_operation text,
  wake_occurred_at timestamptz,
  wake_timeliness text,
  departure_operation text,
  departure_occurred_at timestamptz,
  departure_timeliness text,
  arrival_operation text,
  arrival_occurred_at timestamptz,
  arrival_timeliness text,
  start_work_at timestamptz,
  end_work_at timestamptz,
  placement_labels text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid;
begin
  if v_actor_id is null
     or p_assignment_ids is null
     or pg_catalog.cardinality(p_assignment_ids) = 0
     or pg_catalog.cardinality(p_assignment_ids) > 50 then
    return;
  end if;

  select w.id
  into v_worker_id
  from public.profiles as p
  join public.workers as w
    on w.auth_profile_id = p.id
   and w.status = 'active'
  where p.id = v_actor_id
    and p.account_type = 'worker'
    and p.is_active = true;

  if v_worker_id is null then
    return;
  end if;

  return query
  select
    a.id,
    ss.id,
    statement_timestamp(),
    a.status,
    ss.status,
    ss.starts_at,
    ss.ends_at,
    coalesce(ss.meeting_at, ss.starts_at),
    pc.id is not null,
    pc.submitted_at,
    pc.planned_wake_at,
    pc.planned_departure_at,
    wake.operation,
    wake.occurred_at,
    wake.timeliness,
    departure.operation,
    departure.occurred_at,
    departure.timeliness,
    arrival.operation,
    arrival.occurred_at,
    arrival.timeliness,
    attendance.start_work_at,
    attendance.end_work_at,
    coalesce(placement.labels, array[]::text[])
  from public.assignments as a
  join public.shift_slots as ss on ss.id = a.shift_slot_id
  left join public.pre_shift_confirmations as pc on pc.assignment_id = a.id
  left join lateral (
    select e.operation, e.occurred_at, e.timeliness
    from public.assignment_journey_event_versions as e
    where e.assignment_id = a.id and e.journey_type = 'wake'
    order by e.version desc
    limit 1
  ) as wake on true
  left join lateral (
    select e.operation, e.occurred_at, e.timeliness
    from public.assignment_journey_event_versions as e
    where e.assignment_id = a.id and e.journey_type = 'departure'
    order by e.version desc
    limit 1
  ) as departure on true
  left join lateral (
    select e.operation, e.occurred_at, e.timeliness
    from public.assignment_journey_event_versions as e
    where e.assignment_id = a.id and e.journey_type = 'arrival'
    order by e.version desc
    limit 1
  ) as arrival on true
  left join lateral (
    select
      min(event.server_received_at) filter (where event.event_type = 'start_work') as start_work_at,
      min(event.server_received_at) filter (where event.event_type = 'end_work') as end_work_at
    from public.attendance_events as event
    where event.assignment_id = a.id
      and event.event_type in ('start_work', 'end_work')
  ) as attendance on true
  left join lateral (
    select array_agg(distinct position.label order by position.label) as labels
    from public.assignment_placement_segments as segment
    join public.shift_positions as position on position.id = segment.position_id
    where segment.assignment_id = a.id
      and position.retired_at is null
  ) as placement on true
  where a.worker_id = v_worker_id
    and a.id = any(p_assignment_ids)
  order by ss.starts_at, a.id;
end;
$$;

alter function public.submit_own_pre_shift_confirmation(uuid, boolean, text, timestamptz, timestamptz) owner to postgres;
revoke all on function public.submit_own_pre_shift_confirmation(uuid, boolean, text, timestamptz, timestamptz) from public;
revoke all on function public.submit_own_pre_shift_confirmation(uuid, boolean, text, timestamptz, timestamptz) from anon;
revoke all on function public.submit_own_pre_shift_confirmation(uuid, boolean, text, timestamptz, timestamptz) from authenticated;
revoke all on function public.submit_own_pre_shift_confirmation(uuid, boolean, text, timestamptz, timestamptz) from service_role;
grant execute on function public.submit_own_pre_shift_confirmation(uuid, boolean, text, timestamptz, timestamptz) to authenticated;

alter function public.get_own_assignment_journey_facts(uuid[]) owner to postgres;
revoke all on function public.get_own_assignment_journey_facts(uuid[]) from public;
revoke all on function public.get_own_assignment_journey_facts(uuid[]) from anon;
revoke all on function public.get_own_assignment_journey_facts(uuid[]) from authenticated;
revoke all on function public.get_own_assignment_journey_facts(uuid[]) from service_role;
grant execute on function public.get_own_assignment_journey_facts(uuid[]) to authenticated;
