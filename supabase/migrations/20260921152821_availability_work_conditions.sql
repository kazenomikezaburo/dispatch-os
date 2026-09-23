-- STAFF-2E: Worker-owned Availability and nonblocking Work Conditions.

create table public.worker_availability_intervals (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null,
  kind text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint worker_availability_intervals_worker_fkey
    foreign key (worker_id) references public.workers(id) on delete restrict,
  constraint worker_availability_intervals_created_by_fkey
    foreign key (created_by_profile_id) references public.profiles(id) on delete restrict,
  constraint worker_availability_intervals_kind_check
    check (kind in ('available', 'consultable', 'unavailable')),
  constraint worker_availability_intervals_time_check
    check (ends_at > starts_at),
  constraint worker_availability_intervals_retired_check
    check (retired_at is null or retired_at >= created_at),
  constraint worker_availability_intervals_active_time_excl
    exclude using gist (
      worker_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (retired_at is null)
);

create index worker_availability_intervals_worker_start_idx
  on public.worker_availability_intervals(worker_id, starts_at, id)
  where retired_at is null;

create table public.worker_work_conditions (
  worker_id uuid primary key,
  preferred_iso_weekdays smallint[],
  preferred_start_local time without time zone,
  preferred_end_local time without time zone,
  preferred_ends_next_day boolean not null default false,
  preferred_area_note text,
  preferred_work_category_note text,
  transport_preference_note text,
  is_active boolean not null default true,
  updated_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_work_conditions_worker_fkey
    foreign key (worker_id) references public.workers(id) on delete restrict,
  constraint worker_work_conditions_updated_by_fkey
    foreign key (updated_by_profile_id) references public.profiles(id) on delete restrict,
  constraint worker_work_conditions_time_pair_check check (
    (preferred_start_local is null and preferred_end_local is null)
    or (preferred_start_local is not null and preferred_end_local is not null)
  ),
  constraint worker_work_conditions_time_shape_check check (
    (
      preferred_start_local is null
      and preferred_end_local is null
      and not preferred_ends_next_day
    )
    or (
      preferred_start_local is not null
      and preferred_end_local is not null
      and (
        (not preferred_ends_next_day and preferred_end_local > preferred_start_local)
        or (preferred_ends_next_day and preferred_end_local <= preferred_start_local)
      )
    )
  ),
  constraint worker_work_conditions_weekdays_not_empty_check
    check (preferred_iso_weekdays is null or cardinality(preferred_iso_weekdays) > 0),
  constraint worker_work_conditions_area_note_check
    check (preferred_area_note is null or btrim(preferred_area_note) <> ''),
  constraint worker_work_conditions_category_note_check
    check (preferred_work_category_note is null or btrim(preferred_work_category_note) <> ''),
  constraint worker_work_conditions_transport_note_check
    check (transport_preference_note is null or btrim(transport_preference_note) <> '')
);

create function private.can_read_worker_staffing_facts(p_worker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_worker_id = private.current_worker_id()
    or (
      private.is_active_admin()
      and exists (
        select 1
        from public.workers as w
        where w.id = p_worker_id
          and private.has_branch_access(w.branch_id)
      )
    );
$$;

create function private.protect_worker_availability_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.worker_id is distinct from old.worker_id
    or new.kind is distinct from old.kind
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.created_by_profile_id is distinct from old.created_by_profile_id
    or new.created_at is distinct from old.created_at then
    raise exception using errcode = '22023', message = 'availability_identity_immutable';
  end if;

  if old.retired_at is not null and new.retired_at is distinct from old.retired_at then
    raise exception using errcode = '22023', message = 'availability_retirement_immutable';
  end if;

  return new;
end;
$$;

create function private.normalize_worker_work_conditions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_weekdays smallint[];
begin
  if new.preferred_iso_weekdays is not null then
    if exists (
      select 1
      from unnest(new.preferred_iso_weekdays) as day_number
      where day_number not between 1 and 7
    ) then
      raise exception using errcode = '23514', message = 'invalid_preferred_iso_weekday';
    end if;

    select array_agg(distinct day_number order by day_number)
    into v_weekdays
    from unnest(new.preferred_iso_weekdays) as day_number;
    new.preferred_iso_weekdays := v_weekdays;
  end if;

  new.preferred_area_note := nullif(btrim(new.preferred_area_note), '');
  new.preferred_work_category_note := nullif(btrim(new.preferred_work_category_note), '');
  new.transport_preference_note := nullif(btrim(new.transport_preference_note), '');
  return new;
end;
$$;

create trigger protect_worker_availability_identity
before update on public.worker_availability_intervals
for each row execute function private.protect_worker_availability_identity();

create trigger normalize_worker_work_conditions
before insert or update on public.worker_work_conditions
for each row execute function private.normalize_worker_work_conditions();

create trigger set_worker_work_conditions_updated_at
before update on public.worker_work_conditions
for each row execute function public.set_updated_at();

alter table public.worker_availability_intervals enable row level security;
alter table public.worker_work_conditions enable row level security;

create policy "Authorized actors can view Worker Availability"
on public.worker_availability_intervals for select to authenticated
using (private.can_read_worker_staffing_facts(worker_id));

create policy "Authorized actors can view Worker Work Conditions"
on public.worker_work_conditions for select to authenticated
using (private.can_read_worker_staffing_facts(worker_id));

revoke all privileges on table public.worker_availability_intervals
  from public, anon, authenticated;
revoke all privileges on table public.worker_work_conditions
  from public, anon, authenticated;
grant select on table public.worker_availability_intervals to authenticated;
grant select on table public.worker_work_conditions to authenticated;

create function public.create_own_availability_interval(
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid := private.current_worker_id();
  v_id uuid;
begin
  if v_actor_id is null or v_worker_id is null then
    raise exception using errcode = '42501', message = 'worker_availability_forbidden';
  end if;

  insert into public.worker_availability_intervals (
    worker_id, kind, starts_at, ends_at, created_by_profile_id
  ) values (
    v_worker_id, p_kind, p_starts_at, p_ends_at, v_actor_id
  ) returning id into v_id;

  return v_id;
end;
$$;

create function public.retire_own_availability_interval(p_interval_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_id uuid := private.current_worker_id();
begin
  if v_worker_id is null then
    raise exception using errcode = '42501', message = 'worker_availability_forbidden';
  end if;

  update public.worker_availability_intervals
  set retired_at = clock_timestamp()
  where id = p_interval_id
    and worker_id = v_worker_id
    and retired_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'availability_interval_unavailable';
  end if;

  return jsonb_build_object('ok', true, 'retired', true);
end;
$$;

create function public.correct_own_availability_interval(
  p_interval_id uuid,
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid := private.current_worker_id();
  v_replacement_id uuid;
begin
  if v_actor_id is null or v_worker_id is null then
    raise exception using errcode = '42501', message = 'worker_availability_forbidden';
  end if;

  perform 1
  from public.worker_availability_intervals as wai
  where wai.id = p_interval_id
    and wai.worker_id = v_worker_id
    and wai.retired_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'availability_interval_unavailable';
  end if;

  update public.worker_availability_intervals
  set retired_at = clock_timestamp()
  where id = p_interval_id;

  insert into public.worker_availability_intervals (
    worker_id, kind, starts_at, ends_at, created_by_profile_id
  ) values (
    v_worker_id, p_kind, p_starts_at, p_ends_at, v_actor_id
  ) returning id into v_replacement_id;

  return jsonb_build_object(
    'ok', true,
    'retiredIntervalId', p_interval_id,
    'replacementIntervalId', v_replacement_id
  );
end;
$$;

create function public.set_own_work_conditions(
  p_preferred_iso_weekdays smallint[],
  p_preferred_start_local time without time zone,
  p_preferred_end_local time without time zone,
  p_preferred_ends_next_day boolean,
  p_preferred_area_note text,
  p_preferred_work_category_note text,
  p_transport_preference_note text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid := private.current_worker_id();
begin
  if v_actor_id is null or v_worker_id is null then
    raise exception using errcode = '42501', message = 'worker_work_conditions_forbidden';
  end if;

  insert into public.worker_work_conditions (
    worker_id,
    preferred_iso_weekdays,
    preferred_start_local,
    preferred_end_local,
    preferred_ends_next_day,
    preferred_area_note,
    preferred_work_category_note,
    transport_preference_note,
    is_active,
    updated_by_profile_id
  ) values (
    v_worker_id,
    p_preferred_iso_weekdays,
    p_preferred_start_local,
    p_preferred_end_local,
    p_preferred_ends_next_day,
    p_preferred_area_note,
    p_preferred_work_category_note,
    p_transport_preference_note,
    p_is_active,
    v_actor_id
  )
  on conflict (worker_id) do update
  set preferred_iso_weekdays = excluded.preferred_iso_weekdays,
      preferred_start_local = excluded.preferred_start_local,
      preferred_end_local = excluded.preferred_end_local,
      preferred_ends_next_day = excluded.preferred_ends_next_day,
      preferred_area_note = excluded.preferred_area_note,
      preferred_work_category_note = excluded.preferred_work_category_note,
      transport_preference_note = excluded.transport_preference_note,
      is_active = excluded.is_active,
      updated_by_profile_id = excluded.updated_by_profile_id;

  return v_worker_id;
end;
$$;

create function public.get_worker_shift_availability_facts(
  p_worker_id uuid,
  p_shift_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_worker_status text;
  v_worker_branch_id uuid;
  v_shift_branch_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_shift_range tstzrange;
  v_is_worker_self boolean;
  v_is_admin boolean;
  v_any_availability boolean;
  v_unavailable boolean;
  v_available_full boolean;
  v_combined_full boolean;
  v_all_full boolean;
  v_availability_state text;
  v_availability_coverage text;
  v_availability_reason text;
  v_conflicts jsonb;
  v_conditions public.worker_work_conditions%rowtype;
  v_conditions_found boolean;
  v_schedule_configured boolean;
  v_schedule_any boolean;
  v_schedule_full boolean;
  v_schedule_match text;
begin
  select w.status, w.branch_id
  into v_worker_status, v_worker_branch_id
  from public.workers as w
  where w.id = p_worker_id;

  select p.branch_id, ss.starts_at, ss.ends_at
  into v_shift_branch_id, v_starts_at, v_ends_at
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as p on p.id = j.project_id
  where ss.id = p_shift_id;

  v_is_worker_self := private.current_worker_id() = p_worker_id
    and private.worker_can_view_shift_slot(p_shift_id);
  v_is_admin := private.is_active_admin()
    and private.has_branch_access(v_worker_branch_id)
    and private.has_branch_access(v_shift_branch_id);

  if v_worker_status is null
    or v_starts_at is null
    or not (coalesce(v_is_worker_self, false) or coalesce(v_is_admin, false)) then
    return jsonb_build_object(
      'ok', true,
      'sourceAvailable', false,
      'requirementsEligible', null
    );
  end if;

  v_shift_range := tstzrange(v_starts_at, v_ends_at, '[)');

  select
    exists (
      select 1 from public.worker_availability_intervals as wai
      where wai.worker_id = p_worker_id
        and wai.retired_at is null
        and tstzrange(wai.starts_at, wai.ends_at, '[)') && v_shift_range
    ),
    exists (
      select 1 from public.worker_availability_intervals as wai
      where wai.worker_id = p_worker_id
        and wai.retired_at is null
        and wai.kind = 'unavailable'
        and tstzrange(wai.starts_at, wai.ends_at, '[)') && v_shift_range
    ),
    coalesce((
      select range_agg(tstzrange(wai.starts_at, wai.ends_at, '[)')) @> v_shift_range
      from public.worker_availability_intervals as wai
      where wai.worker_id = p_worker_id
        and wai.retired_at is null
        and wai.kind = 'available'
        and tstzrange(wai.starts_at, wai.ends_at, '[)') && v_shift_range
    ), false),
    coalesce((
      select range_agg(tstzrange(wai.starts_at, wai.ends_at, '[)')) @> v_shift_range
      from public.worker_availability_intervals as wai
      where wai.worker_id = p_worker_id
        and wai.retired_at is null
        and wai.kind in ('available', 'consultable')
        and tstzrange(wai.starts_at, wai.ends_at, '[)') && v_shift_range
    ), false),
    coalesce((
      select range_agg(tstzrange(wai.starts_at, wai.ends_at, '[)')) @> v_shift_range
      from public.worker_availability_intervals as wai
      where wai.worker_id = p_worker_id
        and wai.retired_at is null
        and tstzrange(wai.starts_at, wai.ends_at, '[)') && v_shift_range
    ), false)
  into
    v_any_availability,
    v_unavailable,
    v_available_full,
    v_combined_full,
    v_all_full;

  v_availability_coverage := case
    when v_all_full then 'full'
    when v_any_availability then 'partial'
    else 'none'
  end;

  if v_unavailable then
    v_availability_state := 'explicitly_unavailable';
    v_availability_reason := 'availability_unavailable';
  elsif v_available_full then
    v_availability_state := 'explicitly_available';
    v_availability_reason := 'availability_confirmed';
  elsif v_combined_full then
    v_availability_state := 'consultation_required';
    v_availability_reason := 'availability_consultation_required';
  elsif v_any_availability then
    v_availability_state := 'partially_available';
    v_availability_reason := 'availability_partially_confirmed';
  else
    v_availability_state := 'unknown';
    v_availability_reason := 'availability_unknown';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', a.id,
    'shiftId', ss.id,
    'startsAt', ss.starts_at,
    'endsAt', ss.ends_at
  ) order by ss.starts_at, ss.id, a.id), '[]'::jsonb)
  into v_conflicts
  from public.assignments as a
  join public.shift_slots as ss on ss.id = a.shift_slot_id
  where a.worker_id = p_worker_id
    and a.status in ('assigned', 'confirmed', 'completed')
    and tstzrange(ss.starts_at, ss.ends_at, '[)') && v_shift_range;

  select wc.*
  into v_conditions
  from public.worker_work_conditions as wc
  where wc.worker_id = p_worker_id
    and wc.is_active;

  v_conditions_found := found;
  v_schedule_configured := v_conditions_found and (
    v_conditions.preferred_iso_weekdays is not null
    or v_conditions.preferred_start_local is not null
  );

  if not v_schedule_configured then
    v_schedule_match := 'not_configured';
  else
    with local_dates as (
      select day_value::date as local_date
      from generate_series(
        (v_starts_at at time zone 'Asia/Tokyo')::date - 1,
        (v_ends_at at time zone 'Asia/Tokyo')::date,
        interval '1 day'
      ) as day_value
    ), preference_ranges as (
      select tstzrange(
        (
          local_date::timestamp
          + coalesce(v_conditions.preferred_start_local, time '00:00')
        ) at time zone 'Asia/Tokyo',
        (
          (local_date + case
            when v_conditions.preferred_start_local is null then 1
            when v_conditions.preferred_ends_next_day then 1
            else 0
          end)::timestamp
          + coalesce(v_conditions.preferred_end_local, time '00:00')
        ) at time zone 'Asia/Tokyo',
        '[)'
      ) as preferred_range
      from local_dates
      where v_conditions.preferred_iso_weekdays is null
        or extract(isodow from local_date)::smallint
          = any(v_conditions.preferred_iso_weekdays)
    )
    select
      coalesce(bool_or(preferred_range && v_shift_range), false),
      coalesce(range_agg(preferred_range) @> v_shift_range, false)
    into v_schedule_any, v_schedule_full
    from preference_ranges;

    v_schedule_match := case
      when v_schedule_full then 'matched'
      when v_schedule_any then 'partially_matched'
      else 'not_matched'
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'sourceAvailable', true,
    'workerId', p_worker_id,
    'shiftId', p_shift_id,
    'evaluatedInterval', jsonb_build_object(
      'startsAt', v_starts_at,
      'endsAt', v_ends_at,
      'timeZone', 'Asia/Tokyo'
    ),
    'workerStatus', v_worker_status,
    'workerStatusEligible', v_worker_status = 'active',
    'workerStatusReasonCodes', case v_worker_status
      when 'inactive' then jsonb_build_array('worker_inactive')
      when 'suspended' then jsonb_build_array('worker_suspended')
      else '[]'::jsonb
    end,
    'availabilityEligible', not v_unavailable,
    'availabilityState', v_availability_state,
    'availabilityCoverage', v_availability_coverage,
    'availabilityReasonCodes', jsonb_build_array(v_availability_reason),
    'overlapEligible', jsonb_array_length(v_conflicts) = 0,
    'overlapReasonCodes', case
      when jsonb_array_length(v_conflicts) > 0
        then jsonb_build_array('assignment_time_conflict')
      else '[]'::jsonb
    end,
    'conflictingAssignments', v_conflicts,
    'preferenceMatches', jsonb_build_object(
      'preferredSchedule', v_schedule_match,
      'preferredArea', case
        when v_conditions_found and v_conditions.preferred_area_note is not null
          then 'informational_only'
        else 'not_configured'
      end,
      'preferredWorkCategory', case
        when v_conditions_found and v_conditions.preferred_work_category_note is not null
          then 'informational_only'
        else 'not_configured'
      end,
      'transport', case
        when v_conditions_found and v_conditions.transport_preference_note is not null
          then 'informational_only'
        else 'not_configured'
      end
    )
  );
end;
$$;

alter function private.can_read_worker_staffing_facts(uuid) owner to postgres;
alter function private.protect_worker_availability_identity() owner to postgres;
alter function private.normalize_worker_work_conditions() owner to postgres;
alter function public.create_own_availability_interval(text, timestamptz, timestamptz) owner to postgres;
alter function public.retire_own_availability_interval(uuid) owner to postgres;
alter function public.correct_own_availability_interval(uuid, text, timestamptz, timestamptz) owner to postgres;
alter function public.set_own_work_conditions(smallint[], time without time zone, time without time zone, boolean, text, text, text, boolean) owner to postgres;
alter function public.get_worker_shift_availability_facts(uuid, uuid) owner to postgres;

revoke all on function private.can_read_worker_staffing_facts(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.protect_worker_availability_identity()
  from public, anon, authenticated, service_role;
revoke all on function private.normalize_worker_work_conditions()
  from public, anon, authenticated, service_role;
revoke all on function public.create_own_availability_interval(text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.retire_own_availability_interval(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.correct_own_availability_interval(uuid, text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.set_own_work_conditions(smallint[], time without time zone, time without time zone, boolean, text, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.get_worker_shift_availability_facts(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.can_read_worker_staffing_facts(uuid) to authenticated;
grant execute on function public.create_own_availability_interval(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.retire_own_availability_interval(uuid) to authenticated;
grant execute on function public.correct_own_availability_interval(uuid, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.set_own_work_conditions(smallint[], time without time zone, time without time zone, boolean, text, text, text, boolean) to authenticated;
grant execute on function public.get_worker_shift_availability_facts(uuid, uuid) to authenticated;
