-- DB-2.5C2: Break persistence and the only normal Placement Plan write path.

alter table public.shift_positions
  drop constraint shift_positions_plan_id_display_order_key;

create unique index shift_positions_active_plan_display_order_unique
  on public.shift_positions(plan_id, display_order)
  where retired_at is null;

create table public.assignment_break_intervals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  shift_slot_id uuid not null,
  assignment_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_break_intervals_plan_shift_fkey
    foreign key (plan_id, shift_slot_id)
    references public.shift_placement_plans(id, shift_slot_id)
    on delete restrict,
  constraint assignment_break_intervals_assignment_shift_fkey
    foreign key (assignment_id, shift_slot_id)
    references public.assignments(id, shift_slot_id)
    on delete restrict,
  constraint assignment_break_intervals_time_range_check
    check (end_at > start_at),
  constraint assignment_break_intervals_assignment_time_excl
    exclude using gist (
      assignment_id with =,
      tstzrange(start_at, end_at, '[)') with &&
    )
);

create index idx_assignment_break_intervals_plan_start
  on public.assignment_break_intervals(plan_id, start_at);

create index idx_assignment_break_intervals_assignment_start
  on public.assignment_break_intervals(assignment_id, start_at);

create table public.shift_placement_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  shift_slot_id uuid not null,
  version_from bigint not null,
  version_to bigint not null,
  actor_profile_id uuid not null,
  reason text,
  idempotency_key text not null,
  request_snapshot jsonb not null,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint shift_placement_plan_revisions_plan_shift_fkey
    foreign key (plan_id, shift_slot_id)
    references public.shift_placement_plans(id, shift_slot_id)
    on delete restrict,
  constraint shift_placement_plan_revisions_actor_profile_id_fkey
    foreign key (actor_profile_id)
    references public.profiles(id)
    on delete restrict,
  constraint shift_placement_plan_revisions_version_check
    check (version_from >= 0 and version_to >= 1 and version_to = version_from + 1),
  constraint shift_placement_plan_revisions_reason_check
    check (reason is null or (btrim(reason) <> '' and char_length(reason) <= 500)),
  constraint shift_placement_plan_revisions_idempotency_key_check
    check (btrim(idempotency_key) <> '' and char_length(idempotency_key) <= 128),
  constraint shift_placement_plan_revisions_actor_idempotency_key_key
    unique (actor_profile_id, idempotency_key)
);

create index idx_shift_placement_plan_revisions_plan_version
  on public.shift_placement_plan_revisions(plan_id, version_to desc);

create trigger set_assignment_break_intervals_updated_at
before update on public.assignment_break_intervals
for each row execute function public.set_updated_at();

alter table public.assignment_break_intervals enable row level security;
alter table public.shift_placement_plan_revisions enable row level security;

create policy "Managers can view branch assignment break intervals"
on public.assignment_break_intervals for select to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id));

create policy "System admins can view all assignment break intervals"
on public.assignment_break_intervals for select to authenticated
using (private.is_system_admin());

create policy "Managers can view branch shift placement plan revisions"
on public.shift_placement_plan_revisions for select to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id));

create policy "System admins can view all shift placement plan revisions"
on public.shift_placement_plan_revisions for select to authenticated
using (private.is_system_admin());

revoke all privileges on table public.assignment_break_intervals from anon;
revoke all privileges on table public.assignment_break_intervals from authenticated;
grant select on table public.assignment_break_intervals to authenticated;

revoke all privileges on table public.shift_placement_plan_revisions from anon;
revoke all privileges on table public.shift_placement_plan_revisions from authenticated;
grant select on table public.shift_placement_plan_revisions to authenticated;

create function public.save_shift_placement_plan(
  p_shift_slot_id uuid,
  p_expected_version bigint,
  p_idempotency_key text,
  p_reason text,
  p_positions jsonb,
  p_placement_segments jsonb,
  p_break_intervals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_shift record;
  v_plan record;
  v_revision record;
  v_current_version bigint := 0;
  v_next_version bigint;
  v_plan_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request jsonb;
  v_before jsonb;
  v_after jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_revision_id uuid;
  v_requires_reason boolean := false;
begin
  if p_shift_slot_id is null or p_expected_version is null or p_expected_version < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or char_length(p_idempotency_key) > 128 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if jsonb_typeof(p_positions) <> 'array'
    or jsonb_typeof(p_placement_segments) <> 'array'
    or jsonb_typeof(p_break_intervals) <> 'array'
    or jsonb_array_length(p_positions) > 100
    or jsonb_array_length(p_placement_segments) > 1000
    or jsonb_array_length(p_break_intervals) > 1000 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_positions) as e(value)
    where jsonb_typeof(e.value) <> 'object'
      or not (e.value ? 'id' and e.value ? 'label' and e.value ? 'display_order')
      or exists (select 1 from jsonb_object_keys(e.value) as k(key) where k.key not in ('id', 'label', 'required_workers', 'display_order', 'retired'))
  ) or exists (
    select 1 from jsonb_array_elements(p_placement_segments) as e(value)
    where jsonb_typeof(e.value) <> 'object'
      or not (e.value ? 'id' and e.value ? 'assignment_id' and e.value ? 'position_id' and e.value ? 'start_at' and e.value ? 'end_at')
      or exists (select 1 from jsonb_object_keys(e.value) as k(key) where k.key not in ('id', 'assignment_id', 'position_id', 'start_at', 'end_at'))
  ) or exists (
    select 1 from jsonb_array_elements(p_break_intervals) as e(value)
    where jsonb_typeof(e.value) <> 'object'
      or not (e.value ? 'id' and e.value ? 'assignment_id' and e.value ? 'start_at' and e.value ? 'end_at')
      or exists (select 1 from jsonb_object_keys(e.value) as k(key) where k.key not in ('id', 'assignment_id', 'start_at', 'end_at'))
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select p.account_type into v_account_type
  from public.profiles as p
  where p.id = v_actor_id and p.is_active = true;
  if v_account_type not in ('manager', 'system_admin') then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select ss.id, ss.starts_at, ss.ends_at, ss.required_workers, ss.break_minutes, ss.status
  into v_shift
  from public.shift_slots as ss
  where ss.id = p_shift_slot_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if not private.has_shift_slot_branch_access(v_shift.id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if v_shift.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;
  v_requires_reason := now() >= v_shift.starts_at;
  if v_requires_reason and (v_reason is null or char_length(v_reason) > 500) then
    raise exception using errcode = 'P0001', message = 'CORRECTION_REASON_REQUIRED';
  end if;
  if not v_requires_reason and v_reason is not null and char_length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select spp.id, spp.version into v_plan
  from public.shift_placement_plans as spp
  where spp.shift_slot_id = p_shift_slot_id
  for update;
  if found then
    v_plan_id := v_plan.id;
    v_current_version := v_plan.version;
  end if;

  v_request := jsonb_build_object(
    'expected_version', p_expected_version,
    'reason', v_reason,
    'positions', coalesce((select jsonb_agg(e.value order by e.value->>'id') from jsonb_array_elements(p_positions) as e(value)), '[]'::jsonb),
    'placement_segments', coalesce((select jsonb_agg(e.value order by e.value->>'id') from jsonb_array_elements(p_placement_segments) as e(value)), '[]'::jsonb),
    'break_intervals', coalesce((select jsonb_agg(e.value order by e.value->>'id') from jsonb_array_elements(p_break_intervals) as e(value)), '[]'::jsonb)
  );

  select r.id, r.plan_id, r.version_to, r.warnings, r.request_snapshot
  into v_revision
  from public.shift_placement_plan_revisions as r
  where r.actor_profile_id = v_actor_id and r.idempotency_key = btrim(p_idempotency_key)
  for update;
  if found then
    if v_revision.request_snapshot <> v_request then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'plan_id', v_revision.plan_id, 'version', v_revision.version_to, 'revision_id', v_revision.id, 'replayed', true, 'warnings', v_revision.warnings);
  end if;

  if v_plan_id is null and p_expected_version <> 0 then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', 0);
  end if;
  if v_plan_id is not null and p_expected_version <> v_current_version then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_current_version);
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_positions) as d(id uuid, label text, required_workers integer, display_order integer, retired boolean)
    group by d.id having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
    group by d.id having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_break_intervals) as d(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz)
    group by d.id having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  if v_plan_id is null then
    insert into public.shift_placement_plans (shift_slot_id, version)
    values (p_shift_slot_id, 1)
    returning id into v_plan_id;
    v_current_version := 0;
  end if;
  v_next_version := v_current_version + 1;

  v_before := jsonb_build_object(
    'version', v_current_version,
    'positions', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'required_workers', p.required_workers, 'display_order', p.display_order, 'retired_at', p.retired_at) order by p.display_order, p.id) from public.shift_positions as p where p.plan_id = v_plan_id), '[]'::jsonb),
    'placement_segments', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'assignment_id', s.assignment_id, 'position_id', s.position_id, 'start_at', s.start_at, 'end_at', s.end_at) order by s.start_at, s.id) from public.assignment_placement_segments as s where s.plan_id = v_plan_id), '[]'::jsonb),
    'break_intervals', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'assignment_id', b.assignment_id, 'start_at', b.start_at, 'end_at', b.end_at) order by b.start_at, b.id) from public.assignment_break_intervals as b where b.plan_id = v_plan_id), '[]'::jsonb)
  );

  if exists (
    select 1 from jsonb_to_recordset(p_positions) as d(id uuid, label text, required_workers integer, display_order integer, retired boolean)
    where d.id is null or btrim(coalesce(d.label, '')) = '' or d.required_workers < 0 or d.display_order < 0
  ) or exists (
    select 1 from jsonb_to_recordset(p_positions) as d(id uuid, label text, required_workers integer, display_order integer, retired boolean)
    where not coalesce(d.retired, false)
    group by d.display_order having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if (select coalesce(sum(d.required_workers), 0) from jsonb_to_recordset(p_positions) as d(id uuid, label text, required_workers integer, display_order integer, retired boolean) where not coalesce(d.retired, false)) > v_shift.required_workers then
    raise exception using errcode = 'P0001', message = 'REQUIREMENT_EXCEEDED';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_positions) as d(id uuid, label text, required_workers integer, display_order integer, retired boolean)
    join public.shift_positions as p on p.id = d.id
    where p.plan_id <> v_plan_id or (p.retired_at is not null and not coalesce(d.retired, false))
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_SCOPE';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
    where d.id is null or d.assignment_id is null or d.position_id is null or d.start_at is null or d.end_at is null or d.end_at <= d.start_at
      or d.start_at < v_shift.starts_at or d.end_at > v_shift.ends_at
  ) or exists (
    select 1 from jsonb_to_recordset(p_break_intervals) as d(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz)
    where d.id is null or d.assignment_id is null or d.start_at is null or d.end_at is null or d.end_at <= d.start_at
      or d.start_at < v_shift.starts_at or d.end_at > v_shift.ends_at
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_TIME_RANGE';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
    left join jsonb_to_recordset(p_positions) as p(id uuid, label text, required_workers integer, display_order integer, retired boolean) on p.id = d.position_id
    where p.id is null or coalesce(p.retired, false)
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_SCOPE';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
    join public.assignment_placement_segments as s on s.id = d.id
    where s.plan_id <> v_plan_id or s.assignment_id <> d.assignment_id
  ) or exists (
    select 1
    from jsonb_to_recordset(p_break_intervals) as d(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz)
    join public.assignment_break_intervals as b on b.id = d.id
    where b.plan_id <> v_plan_id or b.assignment_id <> d.assignment_id
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_SCOPE';
  end if;

  perform 1
  from public.assignments as a
  where a.id in (
    select d.assignment_id from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
    union
    select d.assignment_id from jsonb_to_recordset(p_break_intervals) as d(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz)
  )
  order by a.id
  for update;
  if exists (
    select 1 from (
      select d.assignment_id from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
      union
      select d.assignment_id from jsonb_to_recordset(p_break_intervals) as d(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz)
    ) as requested
    left join public.assignments as a on a.id = requested.assignment_id and a.shift_slot_id = p_shift_slot_id
    where a.id is null or a.status not in ('assigned', 'confirmed') and not (a.status = 'completed' and v_requires_reason)
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_SCOPE';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_placement_segments) as s(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
    join jsonb_to_recordset(p_break_intervals) as b(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz)
      on b.assignment_id = s.assignment_id
     and tstzrange(s.start_at, s.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)')
  ) then
    raise exception using errcode = 'P0001', message = 'OVERLAP';
  end if;

  insert into public.shift_positions (id, plan_id, label, required_workers, display_order, retired_at)
  select d.id, v_plan_id, d.label, d.required_workers, d.display_order,
    case when coalesce(d.retired, false) then now() else null end
  from jsonb_to_recordset(p_positions) as d(id uuid, label text, required_workers smallint, display_order integer, retired boolean)
  on conflict (id) do update set
    label = excluded.label,
    required_workers = excluded.required_workers,
    display_order = excluded.display_order,
    retired_at = excluded.retired_at;

  delete from public.assignment_placement_segments as s
  using public.assignments as a
  where s.plan_id = v_plan_id and a.id = s.assignment_id
    and (a.status in ('assigned', 'confirmed') or (a.status = 'completed' and v_requires_reason))
    and not exists (select 1 from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz) where d.id = s.id);
  delete from public.assignment_break_intervals as b
  using public.assignments as a
  where b.plan_id = v_plan_id and a.id = b.assignment_id
    and (a.status in ('assigned', 'confirmed') or (a.status = 'completed' and v_requires_reason))
    and not exists (select 1 from jsonb_to_recordset(p_break_intervals) as d(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz) where d.id = b.id);
  update public.shift_positions as p
  set retired_at = now()
  where p.plan_id = v_plan_id and p.retired_at is null
    and not exists (select 1 from jsonb_to_recordset(p_positions) as d(id uuid, label text, required_workers smallint, display_order integer, retired boolean) where d.id = p.id);

  insert into public.assignment_placement_segments (id, plan_id, shift_slot_id, assignment_id, position_id, start_at, end_at)
  select d.id, v_plan_id, p_shift_slot_id, d.assignment_id, d.position_id, d.start_at, d.end_at
  from jsonb_to_recordset(p_placement_segments) as d(id uuid, assignment_id uuid, position_id uuid, start_at timestamptz, end_at timestamptz)
  on conflict (id) do update set position_id = excluded.position_id, start_at = excluded.start_at, end_at = excluded.end_at;
  insert into public.assignment_break_intervals (id, plan_id, shift_slot_id, assignment_id, start_at, end_at)
  select d.id, v_plan_id, p_shift_slot_id, d.assignment_id, d.start_at, d.end_at
  from jsonb_to_recordset(p_break_intervals) as d(id uuid, assignment_id uuid, start_at timestamptz, end_at timestamptz)
  on conflict (id) do update set start_at = excluded.start_at, end_at = excluded.end_at;

  select coalesce(jsonb_agg(w.value order by w.value->>'assignment_id', w.value->>'position_id'), '[]'::jsonb)
  into v_warnings
  from (
    select jsonb_build_object('type', case when coalesce(sum(extract(epoch from (b.end_at - b.start_at)) / 60), 0) < v_shift.break_minutes then 'break_under_target' else 'break_over_target' end, 'assignment_id', a.id, 'target', v_shift.break_minutes, 'planned', coalesce(sum(extract(epoch from (b.end_at - b.start_at)) / 60), 0), 'delta', coalesce(sum(extract(epoch from (b.end_at - b.start_at)) / 60), 0) - v_shift.break_minutes) as value
    from public.assignments as a
    left join public.assignment_break_intervals as b on b.plan_id = v_plan_id and b.assignment_id = a.id
    where a.shift_slot_id = p_shift_slot_id and a.status in ('assigned', 'confirmed') and v_shift.break_minutes is not null
    group by a.id
    having coalesce(sum(extract(epoch from (b.end_at - b.start_at)) / 60), 0) <> v_shift.break_minutes
    union all
    select jsonb_build_object('type', 'coverage_shortage', 'position_id', p.id, 'required', p.required_workers, 'placed', count(distinct s.assignment_id), 'shortage', p.required_workers - count(distinct s.assignment_id)) as value
    from public.shift_positions as p
    left join public.assignment_placement_segments as s on s.plan_id = v_plan_id and s.position_id = p.id
    join public.assignments as a on a.id = s.assignment_id and a.status in ('assigned', 'confirmed')
    where p.plan_id = v_plan_id and p.retired_at is null and p.required_workers is not null
    group by p.id, p.required_workers
    having count(distinct s.assignment_id) < p.required_workers
  ) as w;

  update public.shift_placement_plans set version = v_next_version where id = v_plan_id;
  v_after := jsonb_build_object(
    'version', v_next_version,
    'positions', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'required_workers', p.required_workers, 'display_order', p.display_order, 'retired_at', p.retired_at) order by p.display_order, p.id) from public.shift_positions as p where p.plan_id = v_plan_id), '[]'::jsonb),
    'placement_segments', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'assignment_id', s.assignment_id, 'position_id', s.position_id, 'start_at', s.start_at, 'end_at', s.end_at) order by s.start_at, s.id) from public.assignment_placement_segments as s where s.plan_id = v_plan_id), '[]'::jsonb),
    'break_intervals', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'assignment_id', b.assignment_id, 'start_at', b.start_at, 'end_at', b.end_at) order by b.start_at, b.id) from public.assignment_break_intervals as b where b.plan_id = v_plan_id), '[]'::jsonb)
  );
  insert into public.shift_placement_plan_revisions (plan_id, shift_slot_id, version_from, version_to, actor_profile_id, reason, idempotency_key, request_snapshot, before_snapshot, after_snapshot, warnings)
  values (v_plan_id, p_shift_slot_id, v_current_version, v_next_version, v_actor_id, v_reason, btrim(p_idempotency_key), v_request, v_before, v_after, v_warnings)
  returning id into v_revision_id;
  return jsonb_build_object('ok', true, 'plan_id', v_plan_id, 'version', v_next_version, 'revision_id', v_revision_id, 'replayed', false, 'warnings', v_warnings, 'mode', case when v_requires_reason then 'correction' else 'normal' end);
exception when others then
  if sqlerrm in ('INVALID_INPUT', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_STATE', 'CORRECTION_REASON_REQUIRED', 'REQUIREMENT_EXCEEDED', 'INVALID_SCOPE', 'INVALID_TIME_RANGE', 'OVERLAP') then
    raise;
  end if;
  raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
end;
$$;

alter function public.save_shift_placement_plan(uuid, bigint, text, text, jsonb, jsonb, jsonb) owner to postgres;
revoke all on function public.save_shift_placement_plan(uuid, bigint, text, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.save_shift_placement_plan(uuid, bigint, text, text, jsonb, jsonb, jsonb) from anon;
grant execute on function public.save_shift_placement_plan(uuid, bigint, text, text, jsonb, jsonb, jsonb) to authenticated;
