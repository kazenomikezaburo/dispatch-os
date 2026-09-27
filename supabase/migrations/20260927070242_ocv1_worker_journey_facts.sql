-- OCV1-04A: narrow append-only Worker journey facts and correction commands.

create table public.assignment_journey_event_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  journey_type text not null,
  version bigint not null,
  operation text not null,
  occurred_at timestamptz,
  timeliness text,
  actor_profile_id uuid not null,
  actor_category text not null,
  idempotency_key uuid not null,
  request_snapshot jsonb not null,
  correction_reason text,
  created_at timestamptz not null default clock_timestamp(),
  constraint assignment_journey_event_versions_assignment_fkey
    foreign key (assignment_id) references public.assignments(id) on delete restrict,
  constraint assignment_journey_event_versions_actor_fkey
    foreign key (actor_profile_id) references public.profiles(id) on delete restrict,
  constraint assignment_journey_event_versions_type_check
    check (journey_type in ('wake', 'departure', 'arrival')),
  constraint assignment_journey_event_versions_version_check
    check (version >= 1),
  constraint assignment_journey_event_versions_operation_check
    check (operation in ('recorded', 'voided')),
  constraint assignment_journey_event_versions_actor_category_check
    check (actor_category in ('worker', 'manager', 'system_admin')),
  constraint assignment_journey_event_versions_request_check
    check (jsonb_typeof(request_snapshot) = 'object'),
  constraint assignment_journey_event_versions_shape_check
    check (
      (
        operation = 'recorded'
        and occurred_at is not null
        and timeliness in ('early_or_on_time', 'late')
        and correction_reason is null
        and actor_category = 'worker'
      )
      or (
        operation = 'voided'
        and occurred_at is null
        and timeliness is null
        and correction_reason is not null
        and correction_reason = btrim(correction_reason)
        and correction_reason <> ''
        and char_length(correction_reason) <= 500
        and actor_category in ('manager', 'system_admin')
      )
    ),
  constraint assignment_journey_event_versions_first_recorded_check
    check (version > 1 or operation = 'recorded'),
  constraint assignment_journey_event_versions_assignment_type_version_key
    unique (assignment_id, journey_type, version),
  constraint assignment_journey_event_versions_actor_operation_key
    unique (actor_profile_id, operation, idempotency_key)
);

create index assignment_journey_event_versions_current_idx
  on public.assignment_journey_event_versions(assignment_id, journey_type, version desc);

alter table public.assignment_journey_event_versions enable row level security;

revoke all privileges on table public.assignment_journey_event_versions from public;
revoke all privileges on table public.assignment_journey_event_versions from anon;
revoke all privileges on table public.assignment_journey_event_versions from authenticated;
revoke all privileges on table public.assignment_journey_event_versions from service_role;

create function public.record_own_assignment_journey_event(
  p_assignment_id uuid,
  p_journey_type text,
  p_idempotency_key uuid
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
  v_planned_at timestamptz;
  v_open_at timestamptz;
  v_occurred_at timestamptz;
  v_version bigint;
  v_event_id uuid;
  v_request jsonb;
  v_prior record;
  v_current record;
  v_timeliness text;
begin
  if v_actor_id is null
     or p_assignment_id is null
     or p_journey_type is null
     or p_journey_type not in ('wake', 'departure', 'arrival')
     or p_idempotency_key is null then
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

  v_request := jsonb_build_object(
    'command', 'record',
    'assignment_id', p_assignment_id,
    'journey_type', p_journey_type
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':recorded:' || p_idempotency_key::text, 0)
  );

  select e.id, e.assignment_id, e.journey_type, e.version, e.occurred_at,
         e.timeliness, e.request_snapshot
  into v_prior
  from public.assignment_journey_event_versions as e
  where e.actor_profile_id = v_actor_id
    and e.operation = 'recorded'
    and e.idempotency_key = p_idempotency_key;

  if found then
    if v_prior.request_snapshot <> v_request then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'RECORDED',
      'assignment_id', v_prior.assignment_id,
      'journey_type', v_prior.journey_type,
      'version', v_prior.version,
      'event_id', v_prior.id,
      'occurred_at', v_prior.occurred_at,
      'timeliness', v_prior.timeliness,
      'replayed', true
    );
  end if;

  select a.id, a.status as assignment_status, a.shift_slot_id,
         ss.status as shift_status, ss.starts_at, ss.ends_at,
         coalesce(ss.meeting_at, ss.starts_at) as arrival_target,
         pc.planned_wake_at, pc.planned_departure_at
  into v_assignment
  from public.assignments as a
  join public.shift_slots as ss on ss.id = a.shift_slot_id
  left join public.pre_shift_confirmations as pc on pc.assignment_id = a.id
  where a.id = p_assignment_id
    and a.worker_id = v_worker_id
  for update of a;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_assignment.assignment_status not in ('assigned', 'confirmed')
     or v_assignment.shift_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'CLOSED');
  end if;

  v_occurred_at := clock_timestamp();
  if v_occurred_at >= v_assignment.ends_at then
    return jsonb_build_object('ok', false, 'code', 'CLOSED');
  end if;

  select e.id, e.version, e.operation, e.occurred_at, e.timeliness
  into v_current
  from public.assignment_journey_event_versions as e
  where e.assignment_id = p_assignment_id
    and e.journey_type = p_journey_type
  order by e.version desc
  limit 1;

  if found and v_current.operation = 'recorded' then
    return jsonb_build_object(
      'ok', false,
      'code', 'ALREADY_RECORDED',
      'assignment_id', p_assignment_id,
      'journey_type', p_journey_type,
      'version', v_current.version,
      'event_id', v_current.id,
      'occurred_at', v_current.occurred_at,
      'timeliness', v_current.timeliness
    );
  end if;

  if p_journey_type in ('wake', 'departure') then
    if exists (
      select 1
      from public.assignment_journey_event_versions as arrival
      where arrival.assignment_id = p_assignment_id
        and arrival.journey_type = 'arrival'
        and arrival.version = (
          select max(latest.version)
          from public.assignment_journey_event_versions as latest
          where latest.assignment_id = p_assignment_id
            and latest.journey_type = 'arrival'
        )
        and arrival.operation = 'recorded'
    ) or exists (
      select 1
      from public.attendance_events as attendance
      where attendance.assignment_id = p_assignment_id
        and attendance.event_type = 'start_work'
    ) then
      return jsonb_build_object('ok', false, 'code', 'SUPERSEDED');
    end if;
  elsif exists (
    select 1
    from public.attendance_events as attendance
    where attendance.assignment_id = p_assignment_id
      and attendance.event_type = 'start_work'
  ) then
    return jsonb_build_object('ok', false, 'code', 'SUPERSEDED');
  end if;

  if p_journey_type = 'wake' then
    v_planned_at := v_assignment.planned_wake_at;
    if v_planned_at is null then
      return jsonb_build_object('ok', false, 'code', 'NOT_REQUIRED');
    end if;
    v_open_at := v_planned_at - interval '6 hours';
  elsif p_journey_type = 'departure' then
    v_planned_at := v_assignment.planned_departure_at;
    if v_planned_at is null then
      return jsonb_build_object('ok', false, 'code', 'NOT_REQUIRED');
    end if;
    v_open_at := v_planned_at - interval '2 hours';
  else
    v_planned_at := v_assignment.arrival_target;
    v_open_at := v_planned_at - interval '3 hours';
  end if;

  if v_occurred_at < v_open_at then
    return jsonb_build_object(
      'ok', false,
      'code', 'NOT_OPEN',
      'opens_at', v_open_at
    );
  end if;

  v_timeliness := case
    when v_occurred_at <= v_planned_at then 'early_or_on_time'
    else 'late'
  end;

  select coalesce(max(e.version), 0) + 1
  into v_version
  from public.assignment_journey_event_versions as e
  where e.assignment_id = p_assignment_id
    and e.journey_type = p_journey_type;

  insert into public.assignment_journey_event_versions (
    assignment_id,
    journey_type,
    version,
    operation,
    occurred_at,
    timeliness,
    actor_profile_id,
    actor_category,
    idempotency_key,
    request_snapshot
  ) values (
    p_assignment_id,
    p_journey_type,
    v_version,
    'recorded',
    v_occurred_at,
    v_timeliness,
    v_actor_id,
    'worker',
    p_idempotency_key,
    v_request
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'RECORDED',
    'assignment_id', p_assignment_id,
    'journey_type', p_journey_type,
    'version', v_version,
    'event_id', v_event_id,
    'occurred_at', v_occurred_at,
    'timeliness', v_timeliness,
    'replayed', false
  );
end;
$$;

create function public.void_assignment_journey_event(
  p_assignment_id uuid,
  p_journey_type text,
  p_expected_version bigint,
  p_correction_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_reason text := btrim(coalesce(p_correction_reason, ''));
  v_request jsonb;
  v_prior record;
  v_current record;
  v_event_id uuid;
  v_branch_id uuid;
begin
  if v_actor_id is null
     or p_assignment_id is null
     or p_journey_type is null
     or p_journey_type not in ('wake', 'departure', 'arrival')
     or p_expected_version is null
     or p_expected_version < 1
     or v_reason = ''
     or char_length(v_reason) > 500
     or p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select p.account_type
  into v_account_type
  from public.profiles as p
  where p.id = v_actor_id
    and p.is_active = true
    and p.account_type in ('manager', 'system_admin');

  if v_account_type is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select project.branch_id
  into v_branch_id
  from public.assignments as a
  join public.shift_slots as ss on ss.id = a.shift_slot_id
  join public.jobs as job on job.id = ss.job_id
  join public.projects as project on project.id = job.project_id
  where a.id = p_assignment_id
    and (
      v_account_type = 'system_admin'
      or private.has_branch_access(project.branch_id)
    )
  for update of a;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_request := jsonb_build_object(
    'command', 'void',
    'assignment_id', p_assignment_id,
    'journey_type', p_journey_type,
    'expected_version', p_expected_version,
    'correction_reason', v_reason
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':voided:' || p_idempotency_key::text, 0)
  );

  select e.id, e.assignment_id, e.journey_type, e.version, e.request_snapshot
  into v_prior
  from public.assignment_journey_event_versions as e
  where e.actor_profile_id = v_actor_id
    and e.operation = 'voided'
    and e.idempotency_key = p_idempotency_key;

  if found then
    if v_prior.request_snapshot <> v_request then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'VOIDED',
      'assignment_id', v_prior.assignment_id,
      'journey_type', v_prior.journey_type,
      'version', v_prior.version,
      'event_id', v_prior.id,
      'replayed', true
    );
  end if;

  select e.id, e.version, e.operation
  into v_current
  from public.assignment_journey_event_versions as e
  where e.assignment_id = p_assignment_id
    and e.journey_type = p_journey_type
  order by e.version desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_current.version <> p_expected_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'current_version', v_current.version
    );
  end if;

  if v_current.operation <> 'recorded' then
    return jsonb_build_object(
      'ok', false,
      'code', 'STATE_CONFLICT',
      'current_version', v_current.version,
      'current_operation', v_current.operation
    );
  end if;

  insert into public.assignment_journey_event_versions (
    assignment_id,
    journey_type,
    version,
    operation,
    occurred_at,
    timeliness,
    actor_profile_id,
    actor_category,
    idempotency_key,
    request_snapshot,
    correction_reason,
    created_at
  ) values (
    p_assignment_id,
    p_journey_type,
    v_current.version + 1,
    'voided',
    null,
    null,
    v_actor_id,
    v_account_type,
    p_idempotency_key,
    v_request,
    v_reason,
    clock_timestamp()
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'VOIDED',
    'assignment_id', p_assignment_id,
    'journey_type', p_journey_type,
    'version', v_current.version + 1,
    'event_id', v_event_id,
    'replayed', false
  );
end;
$$;

alter function public.record_own_assignment_journey_event(uuid, text, uuid) owner to postgres;
revoke all on function public.record_own_assignment_journey_event(uuid, text, uuid) from public;
revoke all on function public.record_own_assignment_journey_event(uuid, text, uuid) from anon;
revoke all on function public.record_own_assignment_journey_event(uuid, text, uuid) from authenticated;
revoke all on function public.record_own_assignment_journey_event(uuid, text, uuid) from service_role;
grant execute on function public.record_own_assignment_journey_event(uuid, text, uuid) to authenticated;

alter function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) owner to postgres;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from public;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from anon;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from authenticated;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from service_role;
grant execute on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) to authenticated;
