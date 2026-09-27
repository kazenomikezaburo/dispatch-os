-- OCV1-04A: retain the command contract while removing an unused PL/pgSQL target.

create or replace function public.void_assignment_journey_event(
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

  perform 1
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

alter function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) owner to postgres;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from public;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from anon;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from authenticated;
revoke all on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) from service_role;
grant execute on function public.void_assignment_journey_event(uuid, text, bigint, text, uuid) to authenticated;
