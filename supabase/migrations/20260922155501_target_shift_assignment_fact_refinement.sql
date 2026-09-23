-- STAFF-2G.1: separate a target Shift Assignment from conflicts on other Shifts.

create or replace function public.get_worker_shift_availability_facts(
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
  v_result jsonb;
  v_conflicts jsonb;
  v_target_assignment_id uuid;
  v_target_assignment_status text;
begin
  v_result := public.get_worker_shift_availability_facts_internal(
    p_worker_id,
    p_shift_id
  ) - 'requirementsEligible';

  if not coalesce((v_result ->> 'sourceAvailable')::boolean, false) then
    return v_result;
  end if;

  select a.id, a.status
  into v_target_assignment_id, v_target_assignment_status
  from public.assignments as a
  where a.worker_id = p_worker_id
    and a.shift_slot_id = p_shift_id
    and a.status in ('assigned', 'confirmed', 'completed')
  order by a.id
  limit 1;

  select coalesce(
    jsonb_agg(
      conflict.value
      order by
        conflict.value ->> 'startsAt',
        conflict.value ->> 'shiftId',
        conflict.value ->> 'assignmentId'
    ),
    '[]'::jsonb
  )
  into v_conflicts
  from jsonb_array_elements(
    coalesce(v_result -> 'conflictingAssignments', '[]'::jsonb)
  ) as conflict(value)
  where conflict.value ->> 'shiftId' <> p_shift_id::text;

  v_result := jsonb_set(
    v_result,
    '{conflictingAssignments}',
    v_conflicts,
    true
  );
  v_result := jsonb_set(
    v_result,
    '{overlapEligible}',
    to_jsonb(jsonb_array_length(v_conflicts) = 0),
    true
  );
  v_result := jsonb_set(
    v_result,
    '{overlapReasonCodes}',
    case
      when jsonb_array_length(v_conflicts) = 0 then '[]'::jsonb
      else jsonb_build_array('assignment_time_conflict')
    end,
    true
  );
  v_result := jsonb_set(
    v_result,
    '{targetShiftAssignment}',
    case
      when v_target_assignment_id is null then
        jsonb_build_object(
          'state', 'none',
          'assignmentId', null,
          'status', null
        )
      else
        jsonb_build_object(
          'state', 'active_existing',
          'assignmentId', v_target_assignment_id,
          'status', v_target_assignment_status
        )
    end,
    true
  );

  return v_result;
end;
$$;

alter function public.get_worker_shift_candidate_eligibility(uuid, uuid)
  rename to get_worker_shift_candidate_eligibility_internal;

create function public.get_worker_shift_candidate_eligibility(
  p_worker_id uuid,
  p_shift_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with candidate as (
    select public.get_worker_shift_candidate_eligibility_internal(
      p_worker_id,
      p_shift_id
    ) as value
  ), availability as (
    select public.get_worker_shift_availability_facts(
      p_worker_id,
      p_shift_id
    ) as value
  )
  select case
    when coalesce((candidate.value ->> 'sourceAvailable')::boolean, false)
      and coalesce((availability.value ->> 'sourceAvailable')::boolean, false)
      then jsonb_set(
        candidate.value,
        '{targetShiftAssignment}',
        availability.value -> 'targetShiftAssignment',
        true
      )
    else candidate.value
  end
  from candidate
  cross join availability;
$$;

alter function public.get_worker_shift_availability_facts(uuid, uuid)
  owner to postgres;
alter function public.get_worker_shift_candidate_eligibility_internal(uuid, uuid)
  owner to postgres;
alter function public.get_worker_shift_candidate_eligibility(uuid, uuid)
  owner to postgres;

revoke all on function public.get_worker_shift_availability_facts(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_worker_shift_candidate_eligibility_internal(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_worker_shift_candidate_eligibility(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_worker_shift_availability_facts(uuid, uuid)
  to authenticated;
grant execute on function public.get_worker_shift_candidate_eligibility(uuid, uuid)
  to authenticated;
