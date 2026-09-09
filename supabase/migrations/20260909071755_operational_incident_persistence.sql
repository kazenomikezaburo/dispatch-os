-- DB-2.7C: Assignment-centric Operational Incident persistence and commands.

create table public.operational_incidents (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  category text not null,
  message text,
  state text not null default 'open',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  retracted_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint operational_incidents_assignment_id_fkey
    foreign key (assignment_id) references public.assignments(id) on delete restrict,
  constraint operational_incidents_category_check
    check (category in ('site_access', 'assignment_instruction', 'schedule_transport', 'health_safety', 'other')),
  constraint operational_incidents_message_check
    check (message is null or (message = btrim(message) and message <> '' and char_length(message) <= 500)),
  constraint operational_incidents_state_check
    check (state in ('open', 'acknowledged', 'resolved', 'retracted')),
  constraint operational_incidents_version_check check (version >= 1),
  constraint operational_incidents_state_timestamps_check check (
    (state = 'open' and acknowledged_at is null and resolved_at is null and retracted_at is null)
    or (state = 'acknowledged' and acknowledged_at is not null and resolved_at is null and retracted_at is null)
    or (state = 'resolved' and acknowledged_at is not null and resolved_at is not null and retracted_at is null)
    or (state = 'retracted' and acknowledged_at is null and resolved_at is null and retracted_at is not null)
  ),
  constraint operational_incidents_timestamp_order_check check (
    updated_at >= created_at
    and (acknowledged_at is null or acknowledged_at >= created_at)
    and (resolved_at is null or resolved_at >= created_at)
    and (retracted_at is null or retracted_at >= created_at)
    and (resolved_at is null or acknowledged_at is null or resolved_at >= acknowledged_at)
  )
);

create unique index operational_incidents_one_unresolved_per_assignment_idx
  on public.operational_incidents(assignment_id)
  where state in ('open', 'acknowledged');
create index operational_incidents_assignment_created_idx
  on public.operational_incidents(assignment_id, created_at desc, id);
create index operational_incidents_state_created_idx
  on public.operational_incidents(state, created_at, id);

create trigger set_operational_incidents_updated_at
before update on public.operational_incidents
for each row execute function public.set_updated_at();

create table public.operational_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null,
  event_type text not null,
  actor_profile_id uuid not null,
  version_from bigint not null,
  version_to bigint not null,
  idempotency_key text not null,
  request_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint operational_incident_events_incident_id_fkey
    foreign key (incident_id) references public.operational_incidents(id) on delete restrict,
  constraint operational_incident_events_actor_profile_id_fkey
    foreign key (actor_profile_id) references public.profiles(id) on delete restrict,
  constraint operational_incident_events_type_check
    check (event_type in ('created', 'acknowledged', 'resolved', 'retracted')),
  constraint operational_incident_events_version_check
    check (version_from >= 0 and version_to = version_from + 1),
  constraint operational_incident_events_transition_check check (
    (event_type = 'created' and version_from = 0 and version_to = 1)
    or (event_type in ('acknowledged', 'retracted') and version_from >= 1)
    or (event_type = 'resolved' and version_from >= 2)
  ),
  constraint operational_incident_events_idempotency_key_check
    check (idempotency_key = btrim(idempotency_key) and idempotency_key <> '' and char_length(idempotency_key) <= 128),
  constraint operational_incident_events_request_snapshot_check
    check (jsonb_typeof(request_snapshot) = 'object'),
  constraint operational_incident_events_incident_version_key unique (incident_id, version_to),
  constraint operational_incident_events_actor_idempotency_key unique (actor_profile_id, idempotency_key)
);

create index operational_incident_events_incident_created_idx
  on public.operational_incident_events(incident_id, created_at, id);

alter table public.operational_incidents enable row level security;
alter table public.operational_incident_events enable row level security;

create policy "Workers can view own operational incidents"
on public.operational_incidents for select to authenticated
using (private.worker_owns_assignment(assignment_id));

create policy "Managers can view branch operational incidents"
on public.operational_incidents for select to authenticated
using (private.has_assignment_branch_access(assignment_id));

create policy "System admins can view all operational incidents"
on public.operational_incidents for select to authenticated
using (private.is_system_admin());

create policy "Managers can view branch operational incident events"
on public.operational_incident_events for select to authenticated
using (
  exists (
    select 1 from public.operational_incidents as i
    where i.id = incident_id and private.has_assignment_branch_access(i.assignment_id)
  )
);

create policy "System admins can view all operational incident events"
on public.operational_incident_events for select to authenticated
using (private.is_system_admin());

revoke all privileges on table public.operational_incidents from anon;
revoke all privileges on table public.operational_incidents from authenticated;
grant select on table public.operational_incidents to authenticated;
revoke all privileges on table public.operational_incident_events from anon;
revoke all privileges on table public.operational_incident_events from authenticated;
grant select on table public.operational_incident_events to authenticated;

create function public.create_operational_incident(
  p_assignment_id uuid,
  p_category text,
  p_message text,
  p_idempotency_key text
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
  v_shift_status text;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb;
  v_prior record;
  v_existing record;
  v_incident_id uuid;
  v_event_id uuid;
begin
  if p_assignment_id is null or v_actor_id is null or v_key = '' or char_length(v_key) > 128
    or v_message is not null and char_length(v_message) > 500 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  if p_category is null or p_category not in ('site_access', 'assignment_instruction', 'schedule_transport', 'health_safety', 'other') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CATEGORY');
  end if;

  select w.id into v_worker_id
  from public.profiles as p
  join public.workers as w on w.auth_profile_id = p.id and w.status = 'active'
  where p.id = v_actor_id and p.account_type = 'worker' and p.is_active = true;
  if v_worker_id is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select a.id, a.shift_slot_id, a.status into v_assignment
  from public.assignments as a
  where a.id = p_assignment_id and a.worker_id = v_worker_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select ss.status into v_shift_status
  from public.shift_slots as ss where ss.id = v_assignment.shift_slot_id for update;

  v_request := jsonb_build_object('command', 'create', 'assignment_id', p_assignment_id, 'category', p_category, 'message', v_message);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':' || v_key, 0));
  select e.id, e.incident_id, e.version_to, e.request_snapshot into v_prior
  from public.operational_incident_events as e
  where e.actor_profile_id = v_actor_id and e.idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'incident_id', v_prior.incident_id, 'state', 'open', 'version', v_prior.version_to, 'event_id', v_prior.id, 'replayed', true);
  end if;

  if v_assignment.status not in ('assigned', 'confirmed') then
    return jsonb_build_object('ok', false, 'code', 'ASSIGNMENT_NOT_ELIGIBLE');
  end if;
  if v_shift_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'SHIFT_CANCELLED');
  end if;
  select i.id, i.state, i.version into v_existing
  from public.operational_incidents as i
  where i.assignment_id = p_assignment_id and i.state in ('open', 'acknowledged');
  if found then
    return jsonb_build_object('ok', false, 'code', 'ACTIVE_INCIDENT_EXISTS', 'existing_incident_id', v_existing.id, 'current_state', v_existing.state, 'current_version', v_existing.version);
  end if;

  insert into public.operational_incidents (assignment_id, category, message)
  values (p_assignment_id, p_category, v_message)
  returning id into v_incident_id;
  insert into public.operational_incident_events
    (incident_id, event_type, actor_profile_id, version_from, version_to, idempotency_key, request_snapshot)
  values (v_incident_id, 'created', v_actor_id, 0, 1, v_key, v_request)
  returning id into v_event_id;
  return jsonb_build_object('ok', true, 'incident_id', v_incident_id, 'state', 'open', 'version', 1, 'event_id', v_event_id, 'replayed', false);
end;
$$;

create function public.acknowledge_operational_incident(
  p_incident_id uuid,
  p_expected_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_incident record;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb;
  v_prior record;
  v_event_id uuid;
begin
  if p_incident_id is null or v_actor_id is null or p_expected_version is null or p_expected_version < 1 or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  select p.account_type into v_account_type from public.profiles as p
  where p.id = v_actor_id and p.is_active = true and p.account_type in ('manager', 'system_admin');
  if v_account_type is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;

  select i.id, i.assignment_id, i.state, i.version into v_incident
  from public.operational_incidents as i where i.id = p_incident_id for update;
  if not found or (v_account_type = 'manager' and not private.has_assignment_branch_access(v_incident.assignment_id)) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  v_request := jsonb_build_object('command', 'acknowledge', 'incident_id', p_incident_id, 'expected_version', p_expected_version);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':' || v_key, 0));
  select e.id, e.incident_id, e.version_to, e.request_snapshot into v_prior from public.operational_incident_events as e
  where e.actor_profile_id = v_actor_id and e.idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    return jsonb_build_object('ok', true, 'incident_id', v_prior.incident_id, 'state', 'acknowledged', 'version', v_prior.version_to, 'event_id', v_prior.id, 'replayed', true);
  end if;
  if v_incident.version <> p_expected_version then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_incident.version); end if;
  if v_incident.state <> 'open' then return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_incident.state, 'current_version', v_incident.version); end if;

  update public.operational_incidents set state = 'acknowledged', version = version + 1, acknowledged_at = pg_catalog.now()
  where id = p_incident_id;
  insert into public.operational_incident_events
    (incident_id, event_type, actor_profile_id, version_from, version_to, idempotency_key, request_snapshot)
  values (p_incident_id, 'acknowledged', v_actor_id, v_incident.version, v_incident.version + 1, v_key, v_request)
  returning id into v_event_id;
  return jsonb_build_object('ok', true, 'incident_id', p_incident_id, 'state', 'acknowledged', 'version', v_incident.version + 1, 'event_id', v_event_id, 'replayed', false);
end;
$$;

create function public.resolve_operational_incident(
  p_incident_id uuid,
  p_expected_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_incident record;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb;
  v_prior record;
  v_event_id uuid;
begin
  if p_incident_id is null or v_actor_id is null or p_expected_version is null or p_expected_version < 1 or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  select p.account_type into v_account_type from public.profiles as p
  where p.id = v_actor_id and p.is_active = true and p.account_type in ('manager', 'system_admin');
  if v_account_type is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select i.id, i.assignment_id, i.state, i.version into v_incident
  from public.operational_incidents as i where i.id = p_incident_id for update;
  if not found or (v_account_type = 'manager' and not private.has_assignment_branch_access(v_incident.assignment_id)) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  v_request := jsonb_build_object('command', 'resolve', 'incident_id', p_incident_id, 'expected_version', p_expected_version);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':' || v_key, 0));
  select e.id, e.incident_id, e.version_to, e.request_snapshot into v_prior from public.operational_incident_events as e
  where e.actor_profile_id = v_actor_id and e.idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    return jsonb_build_object('ok', true, 'incident_id', v_prior.incident_id, 'state', 'resolved', 'version', v_prior.version_to, 'event_id', v_prior.id, 'replayed', true);
  end if;
  if v_incident.version <> p_expected_version then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_incident.version); end if;
  if v_incident.state <> 'acknowledged' then return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_incident.state, 'current_version', v_incident.version); end if;

  update public.operational_incidents set state = 'resolved', version = version + 1, resolved_at = pg_catalog.now()
  where id = p_incident_id;
  insert into public.operational_incident_events
    (incident_id, event_type, actor_profile_id, version_from, version_to, idempotency_key, request_snapshot)
  values (p_incident_id, 'resolved', v_actor_id, v_incident.version, v_incident.version + 1, v_key, v_request)
  returning id into v_event_id;
  return jsonb_build_object('ok', true, 'incident_id', p_incident_id, 'state', 'resolved', 'version', v_incident.version + 1, 'event_id', v_event_id, 'replayed', false);
end;
$$;

create function public.retract_operational_incident(
  p_incident_id uuid,
  p_expected_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid;
  v_incident record;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb;
  v_prior record;
  v_event_id uuid;
begin
  if p_incident_id is null or v_actor_id is null or p_expected_version is null or p_expected_version < 1 or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  select w.id into v_worker_id from public.profiles as p
  join public.workers as w on w.auth_profile_id = p.id and w.status = 'active'
  where p.id = v_actor_id and p.account_type = 'worker' and p.is_active = true;
  if v_worker_id is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select i.id, i.assignment_id, i.state, i.version into v_incident
  from public.operational_incidents as i
  join public.assignments as a on a.id = i.assignment_id and a.worker_id = v_worker_id
  where i.id = p_incident_id for update of i;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  v_request := jsonb_build_object('command', 'retract', 'incident_id', p_incident_id, 'expected_version', p_expected_version);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':' || v_key, 0));
  select e.id, e.incident_id, e.version_to, e.request_snapshot into v_prior from public.operational_incident_events as e
  where e.actor_profile_id = v_actor_id and e.idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    return jsonb_build_object('ok', true, 'incident_id', v_prior.incident_id, 'state', 'retracted', 'version', v_prior.version_to, 'event_id', v_prior.id, 'replayed', true);
  end if;
  if v_incident.version <> p_expected_version then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_incident.version); end if;
  if v_incident.state <> 'open' then return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_incident.state, 'current_version', v_incident.version); end if;

  update public.operational_incidents set state = 'retracted', version = version + 1, retracted_at = pg_catalog.now()
  where id = p_incident_id;
  insert into public.operational_incident_events
    (incident_id, event_type, actor_profile_id, version_from, version_to, idempotency_key, request_snapshot)
  values (p_incident_id, 'retracted', v_actor_id, v_incident.version, v_incident.version + 1, v_key, v_request)
  returning id into v_event_id;
  return jsonb_build_object('ok', true, 'incident_id', p_incident_id, 'state', 'retracted', 'version', v_incident.version + 1, 'event_id', v_event_id, 'replayed', false);
end;
$$;

alter function public.create_operational_incident(uuid, text, text, text) owner to postgres;
revoke all on function public.create_operational_incident(uuid, text, text, text) from public;
revoke all on function public.create_operational_incident(uuid, text, text, text) from anon;
grant execute on function public.create_operational_incident(uuid, text, text, text) to authenticated;

alter function public.acknowledge_operational_incident(uuid, bigint, text) owner to postgres;
revoke all on function public.acknowledge_operational_incident(uuid, bigint, text) from public;
revoke all on function public.acknowledge_operational_incident(uuid, bigint, text) from anon;
grant execute on function public.acknowledge_operational_incident(uuid, bigint, text) to authenticated;

alter function public.resolve_operational_incident(uuid, bigint, text) owner to postgres;
revoke all on function public.resolve_operational_incident(uuid, bigint, text) from public;
revoke all on function public.resolve_operational_incident(uuid, bigint, text) from anon;
grant execute on function public.resolve_operational_incident(uuid, bigint, text) to authenticated;

alter function public.retract_operational_incident(uuid, bigint, text) owner to postgres;
revoke all on function public.retract_operational_incident(uuid, bigint, text) from public;
revoke all on function public.retract_operational_incident(uuid, bigint, text) from anon;
grant execute on function public.retract_operational_incident(uuid, bigint, text) to authenticated;
