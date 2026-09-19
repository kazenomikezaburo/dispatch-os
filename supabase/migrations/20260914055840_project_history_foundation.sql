-- ADMIN-DATA-3.0B-6B: append-only Project configuration history.
-- Existing rows are intentionally not backfilled.

create table public.project_history_events (
  id bigint generated always as identity primary key,
  project_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  actor_user_id uuid,
  actor_display_name_snapshot text not null,
  event_type text not null,
  target_type text not null,
  target_id uuid not null,
  target_label_snapshot text not null,
  payload jsonb not null default '{}'::jsonb,
  constraint project_history_events_project_id_fkey
    foreign key (project_id) references public.projects(id) on delete restrict,
  constraint project_history_events_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles(id) on delete set null,
  constraint project_history_events_actor_display_name_not_blank
    check (btrim(actor_display_name_snapshot) <> ''),
  constraint project_history_events_target_label_not_blank
    check (btrim(target_label_snapshot) <> ''),
  constraint project_history_events_target_type_check
    check (target_type in ('project', 'job', 'shift')),
  constraint project_history_events_event_type_check
    check (event_type in (
      'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_STATUS_CHANGED',
      'JOB_CREATED', 'JOB_UPDATED', 'JOB_STATUS_CHANGED', 'JOB_WORKPLACE_CHANGED',
      'SHIFT_CREATED', 'SHIFT_UPDATED', 'SHIFT_STATUS_CHANGED'
    )),
  constraint project_history_events_event_target_check
    check (
      (target_type = 'project' and event_type like 'PROJECT_%')
      or (target_type = 'job' and event_type like 'JOB_%')
      or (target_type = 'shift' and event_type like 'SHIFT_%')
    ),
  constraint project_history_events_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index project_history_events_project_created_id_idx
  on public.project_history_events (project_id, created_at desc, id desc);

alter table public.project_history_events enable row level security;

create policy "Active admins can read accessible project history"
on public.project_history_events for select to authenticated
using (
  exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and profile.account_type in ('manager', 'system_admin')
  )
  and private.has_project_branch_access(project_id)
);

revoke all privileges on table public.project_history_events from public, anon, authenticated;
revoke all privileges on sequence public.project_history_events_id_seq from public, anon, authenticated;

create function private.project_history_actor()
returns table(actor_user_id uuid, actor_display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.display_name
  from public.profiles as profile
  where profile.id = (select auth.uid())

  union all

  select null::uuid, 'システム'::text
  where (select auth.uid()) is null
    and not exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
    )
  limit 1;
$$;

create function private.prevent_project_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'PROJECT_HISTORY_IMMUTABLE' using errcode = '55000';
end;
$$;

create trigger prevent_project_history_update
before update on public.project_history_events
for each row execute function private.prevent_project_history_mutation();

create trigger prevent_project_history_delete
before delete on public.project_history_events
for each row execute function private.prevent_project_history_mutation();

create function private.emit_project_history_from_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_actor_display_name text;
  v_changed_fields text[] := array[]::text[];
  v_event_type text;
  v_payload jsonb := '{}'::jsonb;
begin
  select actor.actor_user_id, actor.actor_display_name
  into v_actor_user_id, v_actor_display_name
  from private.project_history_actor() as actor;

  if v_actor_display_name is null then
    raise exception 'PROJECT_HISTORY_ACTOR_UNAVAILABLE' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    insert into public.project_history_events (
      project_id, actor_user_id, actor_display_name_snapshot, event_type,
      target_type, target_id, target_label_snapshot, payload
    ) values (
      new.id, v_actor_user_id, v_actor_display_name, 'PROJECT_CREATED',
      'project', new.id, new.name,
      pg_catalog.jsonb_build_object(
        'status', new.status,
        'start_date', new.start_date,
        'end_date', new.end_date
      )
    );
    return new;
  end if;

  if old.name is distinct from new.name then v_changed_fields := array_append(v_changed_fields, 'name'); end if;
  if old.client_id is distinct from new.client_id then v_changed_fields := array_append(v_changed_fields, 'client_id'); end if;
  if old.project_type is distinct from new.project_type then v_changed_fields := array_append(v_changed_fields, 'project_type'); end if;
  if old.status is distinct from new.status then v_changed_fields := array_append(v_changed_fields, 'status'); end if;
  if old.recruitment_start_at is distinct from new.recruitment_start_at then v_changed_fields := array_append(v_changed_fields, 'recruitment_start_at'); end if;
  if old.recruitment_end_at is distinct from new.recruitment_end_at then v_changed_fields := array_append(v_changed_fields, 'recruitment_end_at'); end if;
  if old.start_date is distinct from new.start_date then v_changed_fields := array_append(v_changed_fields, 'start_date'); end if;
  if old.end_date is distinct from new.end_date then v_changed_fields := array_append(v_changed_fields, 'end_date'); end if;
  if old.description is distinct from new.description then v_changed_fields := array_append(v_changed_fields, 'description'); end if;

  if cardinality(v_changed_fields) = 0 then return new; end if;

  v_event_type := case
    when v_changed_fields = array['status']::text[] then 'PROJECT_STATUS_CHANGED'
    else 'PROJECT_UPDATED'
  end;
  v_payload := pg_catalog.jsonb_build_object('changed_fields', to_jsonb(v_changed_fields));
  if old.status is distinct from new.status then
    v_payload := v_payload || pg_catalog.jsonb_build_object('old_status', old.status, 'new_status', new.status);
  end if;
  if old.start_date is distinct from new.start_date then
    v_payload := v_payload || pg_catalog.jsonb_build_object('old_start_date', old.start_date, 'new_start_date', new.start_date);
  end if;
  if old.end_date is distinct from new.end_date then
    v_payload := v_payload || pg_catalog.jsonb_build_object('old_end_date', old.end_date, 'new_end_date', new.end_date);
  end if;

  insert into public.project_history_events (
    project_id, actor_user_id, actor_display_name_snapshot, event_type,
    target_type, target_id, target_label_snapshot, payload
  ) values (
    new.id, v_actor_user_id, v_actor_display_name, v_event_type,
    'project', new.id, new.name, v_payload
  );
  return new;
end;
$$;

create function private.emit_project_history_from_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_actor_display_name text;
  v_changed_fields text[] := array[]::text[];
  v_event_type text;
  v_old_workplace_label text;
  v_new_workplace_label text;
  v_payload jsonb := '{}'::jsonb;
begin
  select actor.actor_user_id, actor.actor_display_name
  into v_actor_user_id, v_actor_display_name
  from private.project_history_actor() as actor;
  if v_actor_display_name is null then
    raise exception 'PROJECT_HISTORY_ACTOR_UNAVAILABLE' using errcode = '42501';
  end if;

  select workplace.name into v_new_workplace_label
  from public.workplaces as workplace where workplace.id = new.workplace_id;

  if tg_op = 'INSERT' then
    insert into public.project_history_events (
      project_id, actor_user_id, actor_display_name_snapshot, event_type,
      target_type, target_id, target_label_snapshot, payload
    ) values (
      new.project_id, v_actor_user_id, v_actor_display_name, 'JOB_CREATED',
      'job', new.id, new.name,
      pg_catalog.jsonb_build_object(
        'status', new.status,
        'workplace_id', new.workplace_id,
        'workplace_label', v_new_workplace_label
      )
    );
    return new;
  end if;

  if old.name is distinct from new.name then v_changed_fields := array_append(v_changed_fields, 'name'); end if;
  if old.workplace_id is distinct from new.workplace_id then v_changed_fields := array_append(v_changed_fields, 'workplace_id'); end if;
  if old.work_type is distinct from new.work_type then v_changed_fields := array_append(v_changed_fields, 'work_type'); end if;
  if old.description is distinct from new.description then v_changed_fields := array_append(v_changed_fields, 'description'); end if;
  if old.clothing_note is distinct from new.clothing_note then v_changed_fields := array_append(v_changed_fields, 'clothing_note'); end if;
  if old.belongings_note is distinct from new.belongings_note then v_changed_fields := array_append(v_changed_fields, 'belongings_note'); end if;
  if old.access_note is distinct from new.access_note then v_changed_fields := array_append(v_changed_fields, 'access_note'); end if;
  if old.meeting_note is distinct from new.meeting_note then v_changed_fields := array_append(v_changed_fields, 'meeting_note'); end if;
  if old.lodging_note is distinct from new.lodging_note then v_changed_fields := array_append(v_changed_fields, 'lodging_note'); end if;
  if old.transport_type is distinct from new.transport_type then v_changed_fields := array_append(v_changed_fields, 'transport_type'); end if;
  if old.transport_amount is distinct from new.transport_amount then v_changed_fields := array_append(v_changed_fields, 'transport_amount'); end if;
  if old.transport_max_amount is distinct from new.transport_max_amount then v_changed_fields := array_append(v_changed_fields, 'transport_max_amount'); end if;
  if old.status is distinct from new.status then v_changed_fields := array_append(v_changed_fields, 'status'); end if;
  if old.hourly_wage is distinct from new.hourly_wage then v_changed_fields := array_append(v_changed_fields, 'hourly_wage'); end if;
  if old.transportation_fee_cap is distinct from new.transportation_fee_cap then v_changed_fields := array_append(v_changed_fields, 'transportation_fee_cap'); end if;
  if old.dress_code is distinct from new.dress_code then v_changed_fields := array_append(v_changed_fields, 'dress_code'); end if;
  if old.requirements is distinct from new.requirements then v_changed_fields := array_append(v_changed_fields, 'requirements'); end if;
  if old.meal_notes is distinct from new.meal_notes then v_changed_fields := array_append(v_changed_fields, 'meal_notes'); end if;
  if old.recruitment_notes is distinct from new.recruitment_notes then v_changed_fields := array_append(v_changed_fields, 'recruitment_notes'); end if;
  if old.manual_url is distinct from new.manual_url then v_changed_fields := array_append(v_changed_fields, 'manual_url'); end if;

  if cardinality(v_changed_fields) = 0 then return new; end if;

  if old.workplace_id is distinct from new.workplace_id then
    select workplace.name into v_old_workplace_label
    from public.workplaces as workplace where workplace.id = old.workplace_id;
  end if;
  v_event_type := case
    when v_changed_fields = array['status']::text[] then 'JOB_STATUS_CHANGED'
    when v_changed_fields = array['workplace_id']::text[] then 'JOB_WORKPLACE_CHANGED'
    else 'JOB_UPDATED'
  end;
  v_payload := pg_catalog.jsonb_build_object('changed_fields', to_jsonb(v_changed_fields));
  if old.status is distinct from new.status then
    v_payload := v_payload || pg_catalog.jsonb_build_object('old_status', old.status, 'new_status', new.status);
  end if;
  if old.workplace_id is distinct from new.workplace_id then
    v_payload := v_payload || pg_catalog.jsonb_build_object(
      'old_workplace_id', old.workplace_id,
      'old_workplace_label', v_old_workplace_label,
      'new_workplace_id', new.workplace_id,
      'new_workplace_label', v_new_workplace_label
    );
  end if;

  insert into public.project_history_events (
    project_id, actor_user_id, actor_display_name_snapshot, event_type,
    target_type, target_id, target_label_snapshot, payload
  ) values (
    new.project_id, v_actor_user_id, v_actor_display_name, v_event_type,
    'job', new.id, new.name, v_payload
  );
  return new;
end;
$$;

create function private.emit_project_history_from_shift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_actor_display_name text;
  v_project_id uuid;
  v_job_label text;
  v_workplace_id uuid;
  v_workplace_label text;
  v_changed_fields text[] := array[]::text[];
  v_event_type text;
  v_payload jsonb := '{}'::jsonb;
  v_target_label text;
begin
  select actor.actor_user_id, actor.actor_display_name
  into v_actor_user_id, v_actor_display_name
  from private.project_history_actor() as actor;
  if v_actor_display_name is null then
    raise exception 'PROJECT_HISTORY_ACTOR_UNAVAILABLE' using errcode = '42501';
  end if;

  select job.project_id, job.name, workplace.id, workplace.name
  into v_project_id, v_job_label, v_workplace_id, v_workplace_label
  from public.jobs as job
  join public.workplaces as workplace on workplace.id = job.workplace_id
  where job.id = new.job_id;
  if v_project_id is null then
    raise exception 'PROJECT_HISTORY_SHIFT_CONTEXT_UNAVAILABLE' using errcode = '23503';
  end if;
  v_target_label := coalesce(nullif(btrim(new.label), ''), to_char(new.starts_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'));

  if tg_op = 'INSERT' then
    insert into public.project_history_events (
      project_id, actor_user_id, actor_display_name_snapshot, event_type,
      target_type, target_id, target_label_snapshot, payload
    ) values (
      v_project_id, v_actor_user_id, v_actor_display_name, 'SHIFT_CREATED',
      'shift', new.id, v_target_label,
      pg_catalog.jsonb_build_object(
        'status', new.status,
        'starts_at', new.starts_at,
        'ends_at', new.ends_at,
        'job_id', new.job_id,
        'job_label', v_job_label,
        'workplace_id', v_workplace_id,
        'workplace_label', v_workplace_label
      )
    );
    return new;
  end if;

  if old.label is distinct from new.label then v_changed_fields := array_append(v_changed_fields, 'label'); end if;
  if old.job_id is distinct from new.job_id then v_changed_fields := array_append(v_changed_fields, 'job_id'); end if;
  if old.starts_at is distinct from new.starts_at then v_changed_fields := array_append(v_changed_fields, 'starts_at'); end if;
  if old.ends_at is distinct from new.ends_at then v_changed_fields := array_append(v_changed_fields, 'ends_at'); end if;
  if old.meeting_at is distinct from new.meeting_at then v_changed_fields := array_append(v_changed_fields, 'meeting_at'); end if;
  if old.required_workers is distinct from new.required_workers then v_changed_fields := array_append(v_changed_fields, 'required_workers'); end if;
  if old.planned_break_minutes is distinct from new.planned_break_minutes then v_changed_fields := array_append(v_changed_fields, 'planned_break_minutes'); end if;
  if old.break_minutes is distinct from new.break_minutes then v_changed_fields := array_append(v_changed_fields, 'break_minutes'); end if;
  if old.application_deadline is distinct from new.application_deadline then v_changed_fields := array_append(v_changed_fields, 'application_deadline'); end if;
  if old.status is distinct from new.status then v_changed_fields := array_append(v_changed_fields, 'status'); end if;

  if cardinality(v_changed_fields) = 0 then return new; end if;
  v_event_type := case
    when v_changed_fields = array['status']::text[] then 'SHIFT_STATUS_CHANGED'
    else 'SHIFT_UPDATED'
  end;
  v_payload := pg_catalog.jsonb_build_object('changed_fields', to_jsonb(v_changed_fields));
  if old.status is distinct from new.status then
    v_payload := v_payload || pg_catalog.jsonb_build_object('old_status', old.status, 'new_status', new.status);
  end if;
  if old.starts_at is distinct from new.starts_at then
    v_payload := v_payload || pg_catalog.jsonb_build_object('old_starts_at', old.starts_at, 'new_starts_at', new.starts_at);
  end if;
  if old.ends_at is distinct from new.ends_at then
    v_payload := v_payload || pg_catalog.jsonb_build_object('old_ends_at', old.ends_at, 'new_ends_at', new.ends_at);
  end if;

  insert into public.project_history_events (
    project_id, actor_user_id, actor_display_name_snapshot, event_type,
    target_type, target_id, target_label_snapshot, payload
  ) values (
    v_project_id, v_actor_user_id, v_actor_display_name, v_event_type,
    'shift', new.id, v_target_label, v_payload
  );
  return new;
end;
$$;

create trigger emit_project_history_from_project
after insert or update on public.projects
for each row execute function private.emit_project_history_from_project();

create trigger emit_project_history_from_job
after insert or update on public.jobs
for each row execute function private.emit_project_history_from_job();

create trigger emit_project_history_from_shift
after insert or update on public.shift_slots
for each row execute function private.emit_project_history_from_shift();

create function public.list_project_history_events(
  p_project_id uuid,
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_project_id is null or p_limit < 1 or p_limit > 50 then
    raise exception 'INVALID_PROJECT_HISTORY_QUERY' using errcode = '22023';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PROJECT_HISTORY_CURSOR' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    join public.projects as project on project.id = p_project_id
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and profile.account_type in ('manager', 'system_admin')
      and private.has_branch_access(project.branch_id)
  ) then
    return pg_catalog.jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null);
  end if;

  with candidate as (
    select event.id, event.created_at, event.actor_display_name_snapshot,
      event.event_type, event.target_type, event.target_id,
      event.target_label_snapshot, event.payload
    from public.project_history_events as event
    where event.project_id = p_project_id
      and (
        p_before_created_at is null
        or (event.created_at, event.id) < (p_before_created_at, p_before_id)
      )
    order by event.created_at desc, event.id desc
    limit p_limit + 1
  ), numbered as (
    select candidate.*, row_number() over (order by candidate.created_at desc, candidate.id desc) as row_number
    from candidate
  ), page as (
    select * from numbered where row_number <= p_limit
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce(
      (select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', page.id,
          'created_at', page.created_at,
          'actor_display_name', page.actor_display_name_snapshot,
          'event_type', page.event_type,
          'target_type', page.target_type,
          'target_id', page.target_id,
          'target_label', page.target_label_snapshot,
          'payload', page.payload
        ) order by page.created_at desc, page.id desc
      ) from page),
      '[]'::jsonb
    ),
    'next_cursor', case when (select count(*) from numbered) > p_limit then
      (select pg_catalog.jsonb_build_object('created_at', page.created_at, 'id', page.id)
       from page order by page.created_at asc, page.id asc limit 1)
      else null end
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function private.project_history_actor() from public, anon, authenticated;
revoke all on function private.prevent_project_history_mutation() from public, anon, authenticated;
revoke all on function private.emit_project_history_from_project() from public, anon, authenticated;
revoke all on function private.emit_project_history_from_job() from public, anon, authenticated;
revoke all on function private.emit_project_history_from_shift() from public, anon, authenticated;
revoke all on function public.list_project_history_events(uuid, integer, timestamptz, bigint) from public, anon;
grant execute on function public.list_project_history_events(uuid, integer, timestamptz, bigint) to authenticated;

comment on table public.project_history_events is
  'Append-only, business-facing Project configuration history recorded after ADMIN-DATA-3.0B-6B.';
comment on function public.list_project_history_events(uuid, integer, timestamptz, bigint) is
  'Returns one authorized Project history page; inaccessible and nonexistent Projects both return an empty page.';
