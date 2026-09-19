-- ADMIN-UI-3.0B-6G: atomic shared Workplace update attributed to one Project context.

alter table public.project_history_events drop constraint project_history_events_target_type_check;
alter table public.project_history_events add constraint project_history_events_target_type_check
  check (target_type in ('project', 'job', 'shift', 'workplace'));
alter table public.project_history_events drop constraint project_history_events_event_type_check;
alter table public.project_history_events add constraint project_history_events_event_type_check
  check (event_type in (
    'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_STATUS_CHANGED',
    'JOB_CREATED', 'JOB_UPDATED', 'JOB_STATUS_CHANGED', 'JOB_WORKPLACE_CHANGED',
    'SHIFT_CREATED', 'SHIFT_UPDATED', 'SHIFT_STATUS_CHANGED',
    'PROJECT_CONTEXT_WORKPLACE_UPDATED'
  ));
alter table public.project_history_events drop constraint project_history_events_event_target_check;
alter table public.project_history_events add constraint project_history_events_event_target_check
  check (
    (target_type = 'project' and event_type like 'PROJECT_%' and event_type <> 'PROJECT_CONTEXT_WORKPLACE_UPDATED')
    or (target_type = 'job' and event_type like 'JOB_%')
    or (target_type = 'shift' and event_type like 'SHIFT_%')
    or (target_type = 'workplace' and event_type = 'PROJECT_CONTEXT_WORKPLACE_UPDATED')
  );

create function public.update_project_context_workplace(
  p_project_id uuid, p_job_id uuid, p_workplace_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_postal_code text, p_address text, p_default_transport_note text,
  p_access_note text, p_meeting_note text, p_is_active boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workplace public.workplaces%rowtype;
  v_job_name text;
  v_actor_user_id uuid;
  v_actor_display_name text;
  v_changed_fields text[] := array[]::text[];
begin
  if p_project_id is null or p_job_id is null or p_workplace_id is null or p_expected_updated_at is null
    or nullif(pg_catalog.btrim(p_name), '') is null or nullif(pg_catalog.btrim(p_address), '') is null then
    raise exception 'WORKPLACE_CONTEXT_UNAVAILABLE' using errcode = '42501';
  end if;

  select workplace.* into v_workplace
  from public.workplaces as workplace
  join public.jobs as job on job.workplace_id = workplace.id
  join public.projects as project on project.id = job.project_id and project.branch_id = workplace.branch_id
  join public.profiles as profile on profile.id = (select auth.uid())
  where project.id = p_project_id and job.id = p_job_id and workplace.id = p_workplace_id
    and profile.is_active = true and profile.account_type in ('manager', 'system_admin')
    and private.has_branch_access(project.branch_id)
  for update of workplace;
  if not found then raise exception 'WORKPLACE_CONTEXT_UNAVAILABLE' using errcode = '42501'; end if;
  if v_workplace.updated_at <> p_expected_updated_at then raise exception 'WORKPLACE_UPDATE_CONFLICT' using errcode = 'P0001'; end if;

  select job.name into v_job_name from public.jobs as job where job.id = p_job_id;
  if v_workplace.name is distinct from pg_catalog.btrim(p_name) then v_changed_fields := array_append(v_changed_fields, 'name'); end if;
  if v_workplace.postal_code is distinct from nullif(pg_catalog.btrim(p_postal_code), '') then v_changed_fields := array_append(v_changed_fields, 'postal_code'); end if;
  if v_workplace.address is distinct from pg_catalog.btrim(p_address) then v_changed_fields := array_append(v_changed_fields, 'address'); end if;
  if v_workplace.default_transport_note is distinct from nullif(pg_catalog.btrim(p_default_transport_note), '') then v_changed_fields := array_append(v_changed_fields, 'default_transport_note'); end if;
  if v_workplace.access_note is distinct from nullif(pg_catalog.btrim(p_access_note), '') then v_changed_fields := array_append(v_changed_fields, 'access_note'); end if;
  if v_workplace.meeting_note is distinct from nullif(pg_catalog.btrim(p_meeting_note), '') then v_changed_fields := array_append(v_changed_fields, 'meeting_note'); end if;
  if v_workplace.is_active is distinct from p_is_active then v_changed_fields := array_append(v_changed_fields, 'is_active'); end if;
  if cardinality(v_changed_fields) = 0 then
    return pg_catalog.jsonb_build_object('outcome', 'no_change', 'id', v_workplace.id, 'updated_at', v_workplace.updated_at);
  end if;

  select actor.actor_user_id, actor.actor_display_name into v_actor_user_id, v_actor_display_name
  from private.project_history_actor() as actor;
  if v_actor_display_name is null then raise exception 'WORKPLACE_CONTEXT_UNAVAILABLE' using errcode = '42501'; end if;

  update public.workplaces set name = pg_catalog.btrim(p_name), postal_code = nullif(pg_catalog.btrim(p_postal_code), ''),
    address = pg_catalog.btrim(p_address), default_transport_note = nullif(pg_catalog.btrim(p_default_transport_note), ''),
    access_note = nullif(pg_catalog.btrim(p_access_note), ''), meeting_note = nullif(pg_catalog.btrim(p_meeting_note), ''),
    is_active = p_is_active
  where id = v_workplace.id returning * into v_workplace;

  insert into public.project_history_events (project_id, actor_user_id, actor_display_name_snapshot, event_type, target_type, target_id, target_label_snapshot, payload)
  values (p_project_id, v_actor_user_id, v_actor_display_name, 'PROJECT_CONTEXT_WORKPLACE_UPDATED', 'workplace', v_workplace.id, v_workplace.name,
    pg_catalog.jsonb_build_object('changed_fields', to_jsonb(v_changed_fields), 'job_label', v_job_name));
  return pg_catalog.jsonb_build_object('outcome', 'updated', 'id', v_workplace.id, 'updated_at', v_workplace.updated_at);
end;
$$;

alter function public.update_project_context_workplace(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, boolean) owner to postgres;
revoke all on function public.update_project_context_workplace(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_project_context_workplace(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, boolean) to authenticated;
