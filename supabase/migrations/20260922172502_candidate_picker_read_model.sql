-- STAFF-2G.3: bounded read composer for the Shift-scoped Candidate Picker.
-- Eligibility semantics remain owned by get_worker_shift_candidate_eligibility.

create function public.list_shift_candidate_eligibility(
  p_shift_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shift_branch_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
  v_items jsonb := '[]'::jsonb;
  v_candidate record;
  v_facts jsonb;
  v_seen integer := 0;
  v_truncated boolean := false;
begin
  select p.branch_id
  into v_shift_branch_id
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as p on p.id = j.project_id
  where ss.id = p_shift_id;

  if v_shift_branch_id is null
    or not private.is_active_admin()
    or not private.has_branch_access(v_shift_branch_id) then
    return jsonb_build_object(
      'ok', true,
      'sourceAvailable', false,
      'items', '[]'::jsonb,
      'truncated', false,
      'limit', v_limit
    );
  end if;

  for v_candidate in
    select w.id, w.display_name, w.staff_code
    from public.workers as w
    where private.has_branch_access(w.branch_id)
    order by w.display_name, w.staff_code, w.id
    limit v_limit + 1
  loop
    v_seen := v_seen + 1;
    if v_seen > v_limit then
      v_truncated := true;
      exit;
    end if;

    v_facts := public.get_worker_shift_candidate_eligibility(
      v_candidate.id,
      p_shift_id
    );

    if coalesce((v_facts ->> 'sourceAvailable')::boolean, false) then
      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'workerId', v_candidate.id,
          'displayName', v_candidate.display_name,
          'staffCode', v_candidate.staff_code,
          'facts', v_facts
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'sourceAvailable', true,
    'items', v_items,
    'truncated', v_truncated,
    'limit', v_limit
  );
end;
$$;

alter function public.list_shift_candidate_eligibility(uuid, integer)
  owner to postgres;

revoke all on function public.list_shift_candidate_eligibility(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_shift_candidate_eligibility(uuid, integer)
  to authenticated;
