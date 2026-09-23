-- STAFF-2G.2: convert an authorized Candidate decision into one canonical
-- Assignment without trusting Candidate UI state.

create table private.candidate_assignment_command_receipts (
  actor_profile_id uuid not null,
  idempotency_key text not null,
  shift_id uuid not null,
  worker_id uuid not null,
  assignment_path text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_profile_id, idempotency_key),
  constraint candidate_assignment_receipts_actor_fkey
    foreign key (actor_profile_id)
    references public.profiles(id)
    on delete restrict,
  constraint candidate_assignment_receipts_shift_fkey
    foreign key (shift_id)
    references public.shift_slots(id)
    on delete restrict,
  constraint candidate_assignment_receipts_worker_fkey
    foreign key (worker_id)
    references public.workers(id)
    on delete restrict,
  constraint candidate_assignment_receipts_key_check
    check (
      idempotency_key = btrim(idempotency_key)
      and char_length(idempotency_key) between 1 and 200
    ),
  constraint candidate_assignment_receipts_path_check
    check (assignment_path in ('accepted_application', 'direct_admin')),
  constraint candidate_assignment_receipts_completion_check
    check (
      (result is null and completed_at is null)
      or (result is not null and completed_at is not null)
    )
);

comment on table private.candidate_assignment_command_receipts is
  'Private idempotency receipts for the STAFF-2G.2 candidate Assignment command.';

revoke all on table private.candidate_assignment_command_receipts
  from public, anon, authenticated, service_role;

create function public.ensure_candidate_assignment(
  p_shift_id uuid,
  p_worker_id uuid,
  p_assignment_path text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_shift_branch_id uuid;
  v_worker_branch_id uuid;
  v_shift_status text;
  v_required_workers smallint;
  v_existing_assignment_id uuid;
  v_existing_assignment_source text;
  v_application_status text;
  v_active_count integer;
  v_candidate_facts jsonb;
  v_assignment_id uuid;
  v_result jsonb;
  v_receipt_shift_id uuid;
  v_receipt_worker_id uuid;
  v_receipt_path text;
  v_receipt_result jsonb;
begin
  if p_shift_id is null
    or p_worker_id is null
    or p_assignment_path is null
    or p_assignment_path not in ('accepted_application', 'direct_admin')
    or p_idempotency_key is null
    or p_idempotency_key <> btrim(p_idempotency_key)
    or char_length(p_idempotency_key) not between 1 and 200 then
    raise exception using
      errcode = '22023',
      message = 'invalid_candidate_assignment_request';
  end if;

  if v_actor_id is null or not private.is_active_admin() then
    return jsonb_build_object(
      'ok', false,
      'outcome', 'unavailable',
      'assignmentId', null,
      'replayed', false
    );
  end if;

  -- Canonical lock order: Shift, Worker, existing Assignment, Application,
  -- then the actor-scoped command receipt.
  select p.branch_id, ss.status, ss.required_workers
  into v_shift_branch_id, v_shift_status, v_required_workers
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as p on p.id = j.project_id
  where ss.id = p_shift_id
  for update of ss;

  if not found or not private.has_branch_access(v_shift_branch_id) then
    return jsonb_build_object(
      'ok', false,
      'outcome', 'unavailable',
      'assignmentId', null,
      'replayed', false
    );
  end if;

  select w.branch_id
  into v_worker_branch_id
  from public.workers as w
  where w.id = p_worker_id
  for update;

  if not found or not private.has_branch_access(v_worker_branch_id) then
    return jsonb_build_object(
      'ok', false,
      'outcome', 'unavailable',
      'assignmentId', null,
      'replayed', false
    );
  end if;

  select a.id, a.source
  into v_existing_assignment_id, v_existing_assignment_source
  from public.assignments as a
  where a.shift_slot_id = p_shift_id
    and a.worker_id = p_worker_id
    and a.status in ('assigned', 'confirmed', 'completed')
  order by a.id
  limit 1
  for update;

  select sa.status
  into v_application_status
  from public.shift_applications as sa
  where sa.shift_slot_id = p_shift_id
    and sa.worker_id = p_worker_id
  for update;

  insert into private.candidate_assignment_command_receipts (
    actor_profile_id,
    idempotency_key,
    shift_id,
    worker_id,
    assignment_path
  )
  values (
    v_actor_id,
    p_idempotency_key,
    p_shift_id,
    p_worker_id,
    p_assignment_path
  )
  on conflict (actor_profile_id, idempotency_key) do nothing;

  select
    receipt.shift_id,
    receipt.worker_id,
    receipt.assignment_path,
    receipt.result
  into
    v_receipt_shift_id,
    v_receipt_worker_id,
    v_receipt_path,
    v_receipt_result
  from private.candidate_assignment_command_receipts as receipt
  where receipt.actor_profile_id = v_actor_id
    and receipt.idempotency_key = p_idempotency_key
  for update;

  if v_receipt_shift_id <> p_shift_id
    or v_receipt_worker_id <> p_worker_id
    or v_receipt_path <> p_assignment_path then
    return jsonb_build_object(
      'ok', false,
      'outcome', 'IDEMPOTENCY_CONFLICT',
      'assignmentId', null,
      'replayed', false
    );
  end if;

  if v_receipt_result is not null then
    return jsonb_set(v_receipt_result, '{replayed}', 'true'::jsonb, true);
  end if;

  <<decision>>
  begin
    if v_existing_assignment_id is not null then
      v_result := jsonb_build_object(
        'ok', true,
        'outcome', 'existing_assignment',
        'assignmentId', v_existing_assignment_id,
        'source', v_existing_assignment_source,
        'replayed', false
      );
      exit decision;
    end if;

    if v_shift_status not in ('recruiting', 'closed', 'confirmed', 'in_progress') then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'shift_state_unavailable',
        'assignmentId', null,
        'replayed', false
      );
      exit decision;
    end if;

    if v_application_status = 'accepted'
      and p_assignment_path = 'direct_admin' then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'accepted_application_available',
        'assignmentId', null,
        'replayed', false
      );
      exit decision;
    elsif v_application_status = 'applied' then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'application_decision_required',
        'assignmentId', null,
        'replayed', false
      );
      exit decision;
    elsif v_application_status = 'rejected' then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'application_rejected',
        'assignmentId', null,
        'replayed', false
      );
      exit decision;
    elsif v_application_status = 'withdrawn' then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'application_withdrawn',
        'assignmentId', null,
        'replayed', false
      );
      exit decision;
    elsif p_assignment_path = 'accepted_application'
      and v_application_status is distinct from 'accepted' then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'unavailable',
        'assignmentId', null,
        'replayed', false
      );
      exit decision;
    end if;

    v_candidate_facts := public.get_worker_shift_candidate_eligibility(
      p_worker_id,
      p_shift_id
    );

    if not coalesce((v_candidate_facts ->> 'sourceAvailable')::boolean, false)
      or not coalesce((v_candidate_facts ->> 'candidateEligible')::boolean, false) then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'not_eligible',
        'assignmentId', null,
        'blockingReasons', coalesce(
          v_candidate_facts -> 'blockingReasons',
          '[]'::jsonb
        ),
        'replayed', false
      );
      exit decision;
    end if;

    select count(*)
    into v_active_count
    from public.assignments as a
    where a.shift_slot_id = p_shift_id
      and a.status in ('assigned', 'confirmed', 'completed');

    if v_active_count >= v_required_workers then
      v_result := jsonb_build_object(
        'ok', false,
        'outcome', 'capacity_reached',
        'assignmentId', null,
        'replayed', false
      );
      exit decision;
    end if;

    insert into public.assignments (
      shift_slot_id,
      worker_id,
      source,
      status,
      assigned_by
    )
    values (
      p_shift_id,
      p_worker_id,
      case p_assignment_path
        when 'accepted_application' then 'application'
        else 'manager'
      end,
      'assigned',
      v_actor_id
    )
    returning id into v_assignment_id;

    v_result := jsonb_build_object(
      'ok', true,
      'outcome', 'assignment_created',
      'assignmentId', v_assignment_id,
      'source', case p_assignment_path
        when 'accepted_application' then 'application'
        else 'manager'
      end,
      'replayed', false
    );
  end decision;

  update private.candidate_assignment_command_receipts as receipt
  set result = v_result,
      completed_at = now()
  where receipt.actor_profile_id = v_actor_id
    and receipt.idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

alter function public.ensure_candidate_assignment(uuid, uuid, text, text)
  owner to postgres;

revoke all on function public.ensure_candidate_assignment(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.ensure_candidate_assignment(uuid, uuid, text, text)
  to authenticated;
