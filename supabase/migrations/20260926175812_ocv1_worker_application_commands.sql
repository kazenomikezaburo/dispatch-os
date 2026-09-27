-- OCV1-03: Worker-owned Application commands over the existing
-- shift_applications lifecycle. Applications never reserve Shift capacity.

create table private.worker_application_command_receipts (
  actor_profile_id uuid not null,
  idempotency_key uuid not null,
  operation text not null,
  shift_id uuid not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_profile_id, idempotency_key),
  constraint worker_application_receipts_actor_fkey
    foreign key (actor_profile_id) references public.profiles(id) on delete restrict,
  constraint worker_application_receipts_shift_fkey
    foreign key (shift_id) references public.shift_slots(id) on delete restrict,
  constraint worker_application_receipts_operation_check
    check (operation in ('apply', 'withdraw')),
  constraint worker_application_receipts_completion_check
    check (
      (result is null and completed_at is null)
      or (result is not null and completed_at is not null)
    )
);

comment on table private.worker_application_command_receipts is
  'Actor-scoped idempotency and audit receipts for OCV1 Worker Application commands.';

revoke all on table private.worker_application_command_receipts
  from public, anon, authenticated, service_role;

-- The legacy Worker INSERT policy does not enforce the frozen deadline,
-- capacity, Assignment, or eligibility gates. Worker writes now use only the
-- commands below; Admin review policies remain unchanged.
drop policy if exists "Workers can create own shift applications"
  on public.shift_applications;

create function public.apply_to_own_shift(
  p_shift_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid := private.current_worker_id();
  v_worker_branch_id uuid;
  v_worker_status text;
  v_shift_branch_id uuid;
  v_project_status text;
  v_shift_status text;
  v_starts_at timestamptz;
  v_deadline timestamptz;
  v_required_workers smallint;
  v_job_id uuid;
  v_application_status text;
  v_active_assignment_count integer;
  v_availability jsonb;
  v_requirements_eligible boolean;
  v_receipt_operation text;
  v_receipt_shift_id uuid;
  v_receipt_result jsonb;
  v_result jsonb;
begin
  if p_shift_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'invalid_worker_application_request';
  end if;

  if v_actor_id is null or v_worker_id is null then
    return jsonb_build_object('ok', false, 'outcome', 'unavailable', 'applicationState', null, 'replayed', false);
  end if;

  -- Match the canonical Assignment command lock prefix. Different Workers may
  -- still all apply for the last slot because Applications do not change the
  -- active Assignment count.
  select p.branch_id, p.status, ss.status, ss.starts_at,
    coalesce(ss.application_deadline, ss.starts_at), ss.required_workers, j.id
  into v_shift_branch_id, v_project_status, v_shift_status, v_starts_at,
    v_deadline, v_required_workers, v_job_id
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as p on p.id = j.project_id
  where ss.id = p_shift_id
  for update of ss, p;

  if not found then
    return jsonb_build_object('ok', false, 'outcome', 'unavailable', 'applicationState', null, 'replayed', false);
  end if;

  select w.branch_id, w.status
  into v_worker_branch_id, v_worker_status
  from public.workers as w
  where w.id = v_worker_id and w.auth_profile_id = v_actor_id
  for update;

  if not found or v_worker_status <> 'active' or v_worker_branch_id <> v_shift_branch_id then
    return jsonb_build_object('ok', false, 'outcome', 'unavailable', 'applicationState', null, 'replayed', false);
  end if;

  select sa.status
  into v_application_status
  from public.shift_applications as sa
  where sa.shift_slot_id = p_shift_id and sa.worker_id = v_worker_id
  for update;

  insert into private.worker_application_command_receipts (
    actor_profile_id, idempotency_key, operation, shift_id
  ) values (
    v_actor_id, p_idempotency_key, 'apply', p_shift_id
  ) on conflict (actor_profile_id, idempotency_key) do nothing;

  select receipt.operation, receipt.shift_id, receipt.result
  into v_receipt_operation, v_receipt_shift_id, v_receipt_result
  from private.worker_application_command_receipts as receipt
  where receipt.actor_profile_id = v_actor_id
    and receipt.idempotency_key = p_idempotency_key
  for update;

  if v_receipt_operation <> 'apply' or v_receipt_shift_id <> p_shift_id then
    return jsonb_build_object('ok', false, 'outcome', 'IDEMPOTENCY_CONFLICT', 'applicationState', null, 'replayed', false);
  end if;

  if v_receipt_result is not null then
    return jsonb_set(v_receipt_result, '{replayed}', 'true'::jsonb, true);
  end if;

  <<decision>>
  begin
    if v_application_status = 'applied' then
      v_result := jsonb_build_object('ok', true, 'outcome', 'existing_applied', 'applicationState', 'applied', 'replayed', false);
      exit decision;
    elsif v_application_status in ('accepted', 'rejected', 'withdrawn') then
      v_result := jsonb_build_object('ok', false, 'outcome', 'application_' || v_application_status, 'applicationState', v_application_status, 'replayed', false);
      exit decision;
    end if;

    if exists (
      select 1 from public.assignments as own
      where own.shift_slot_id = p_shift_id
        and own.worker_id = v_worker_id
        and own.status in ('assigned', 'confirmed', 'completed')
    ) then
      v_result := jsonb_build_object('ok', false, 'outcome', 'already_assigned', 'applicationState', null, 'replayed', false);
      exit decision;
    end if;

    if v_project_status <> 'recruiting'
      or v_shift_status <> 'recruiting'
      or v_starts_at <= now() then
      v_result := jsonb_build_object('ok', false, 'outcome', 'not_recruiting', 'applicationState', null, 'replayed', false);
      exit decision;
    end if;

    if v_deadline <= now() then
      v_result := jsonb_build_object('ok', false, 'outcome', 'deadline_passed', 'applicationState', null, 'replayed', false);
      exit decision;
    end if;

    select count(*)
    into v_active_assignment_count
    from public.assignments as a
    where a.shift_slot_id = p_shift_id
      and a.status in ('assigned', 'confirmed', 'completed');

    if v_active_assignment_count >= v_required_workers then
      v_result := jsonb_build_object('ok', false, 'outcome', 'capacity_full', 'applicationState', null, 'replayed', false);
      exit decision;
    end if;

    v_availability := public.get_worker_shift_availability_facts(v_worker_id, p_shift_id);

    select not (
      exists (
        select 1
        from public.job_skill_requirements as requirement
        join public.skills as skill on skill.id = requirement.skill_id
        left join public.worker_skills as holding
          on holding.worker_id = v_worker_id
          and holding.skill_id = requirement.skill_id
          and holding.is_active
        where requirement.job_id = v_job_id
          and (not skill.is_active or holding.worker_id is null)
      )
      or exists (
        select 1
        from public.job_qualification_requirements as requirement
        join public.qualifications as qualification
          on qualification.id = requirement.qualification_id
        left join public.worker_qualifications as holding
          on holding.worker_id = v_worker_id
          and holding.qualification_id = requirement.qualification_id
        where requirement.job_id = v_job_id
          and (
            not qualification.is_active
            or holding.worker_id is null
            or holding.revoked_at is not null
            or (holding.valid_from is not null and holding.valid_from > (v_starts_at at time zone 'Asia/Tokyo')::date)
            or (holding.expires_on is not null and holding.expires_on < (v_starts_at at time zone 'Asia/Tokyo')::date)
          )
      )
    ) into v_requirements_eligible;

    if not coalesce((v_availability ->> 'sourceAvailable')::boolean, false)
      or not coalesce((v_availability ->> 'workerStatusEligible')::boolean, false)
      or not v_requirements_eligible
      or not coalesce((v_availability ->> 'availabilityEligible')::boolean, false)
      or not coalesce((v_availability ->> 'overlapEligible')::boolean, false) then
      v_result := jsonb_build_object('ok', false, 'outcome', 'not_eligible', 'applicationState', null, 'replayed', false);
      exit decision;
    end if;

    insert into public.shift_applications (shift_slot_id, worker_id, status)
    values (p_shift_id, v_worker_id, 'applied');

    v_result := jsonb_build_object('ok', true, 'outcome', 'applied', 'applicationState', 'applied', 'replayed', false);
  end decision;

  update private.worker_application_command_receipts as receipt
  set result = v_result, completed_at = now()
  where receipt.actor_profile_id = v_actor_id
    and receipt.idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

create function public.withdraw_own_shift_application(
  p_shift_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_worker_id uuid := private.current_worker_id();
  v_worker_branch_id uuid;
  v_worker_status text;
  v_shift_branch_id uuid;
  v_application_status text;
  v_receipt_operation text;
  v_receipt_shift_id uuid;
  v_receipt_result jsonb;
  v_result jsonb;
begin
  if p_shift_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'invalid_worker_application_request';
  end if;

  if v_actor_id is null or v_worker_id is null then
    return jsonb_build_object('ok', false, 'outcome', 'unavailable', 'applicationState', null, 'replayed', false);
  end if;

  select p.branch_id
  into v_shift_branch_id
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as p on p.id = j.project_id
  where ss.id = p_shift_id
  for update of ss;

  if not found then
    return jsonb_build_object('ok', false, 'outcome', 'unavailable', 'applicationState', null, 'replayed', false);
  end if;

  select w.branch_id, w.status
  into v_worker_branch_id, v_worker_status
  from public.workers as w
  where w.id = v_worker_id and w.auth_profile_id = v_actor_id
  for update;

  if not found or v_worker_status <> 'active' or v_worker_branch_id <> v_shift_branch_id then
    return jsonb_build_object('ok', false, 'outcome', 'unavailable', 'applicationState', null, 'replayed', false);
  end if;

  select sa.status
  into v_application_status
  from public.shift_applications as sa
  where sa.shift_slot_id = p_shift_id and sa.worker_id = v_worker_id
  for update;

  insert into private.worker_application_command_receipts (
    actor_profile_id, idempotency_key, operation, shift_id
  ) values (
    v_actor_id, p_idempotency_key, 'withdraw', p_shift_id
  ) on conflict (actor_profile_id, idempotency_key) do nothing;

  select receipt.operation, receipt.shift_id, receipt.result
  into v_receipt_operation, v_receipt_shift_id, v_receipt_result
  from private.worker_application_command_receipts as receipt
  where receipt.actor_profile_id = v_actor_id
    and receipt.idempotency_key = p_idempotency_key
  for update;

  if v_receipt_operation <> 'withdraw' or v_receipt_shift_id <> p_shift_id then
    return jsonb_build_object('ok', false, 'outcome', 'IDEMPOTENCY_CONFLICT', 'applicationState', v_application_status, 'replayed', false);
  end if;

  if v_receipt_result is not null then
    return jsonb_set(v_receipt_result, '{replayed}', 'true'::jsonb, true);
  end if;

  if v_application_status = 'applied' then
    update public.shift_applications as application
    set status = 'withdrawn', cancel_reason = 'worker_withdrawal'
    where application.shift_slot_id = p_shift_id
      and application.worker_id = v_worker_id
      and application.status = 'applied';
    v_result := jsonb_build_object('ok', true, 'outcome', 'withdrawn', 'applicationState', 'withdrawn', 'replayed', false);
  elsif v_application_status = 'withdrawn' then
    v_result := jsonb_build_object('ok', true, 'outcome', 'already_withdrawn', 'applicationState', 'withdrawn', 'replayed', false);
  elsif v_application_status in ('accepted', 'rejected') then
    v_result := jsonb_build_object('ok', false, 'outcome', 'application_' || v_application_status, 'applicationState', v_application_status, 'replayed', false);
  else
    v_result := jsonb_build_object('ok', false, 'outcome', 'unavailable', 'applicationState', null, 'replayed', false);
  end if;

  update private.worker_application_command_receipts as receipt
  set result = v_result, completed_at = now()
  where receipt.actor_profile_id = v_actor_id
    and receipt.idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

alter function public.apply_to_own_shift(uuid, uuid) owner to postgres;
alter function public.withdraw_own_shift_application(uuid, uuid) owner to postgres;

revoke all on function public.apply_to_own_shift(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.withdraw_own_shift_application(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.apply_to_own_shift(uuid, uuid) to authenticated;
grant execute on function public.withdraw_own_shift_application(uuid, uuid) to authenticated;
