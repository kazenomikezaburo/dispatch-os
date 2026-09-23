-- STAFF-2F: compose existing requirement and availability facts without
-- persisting or reimplementing their source-domain rules.

create function public.get_worker_shift_candidate_eligibility(
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
  v_worker_branch_id uuid;
  v_shift_branch_id uuid;
  v_requirement_facts jsonb;
  v_availability_facts jsonb;
  v_worker_status_eligible boolean;
  v_requirements_eligible boolean;
  v_availability_eligible boolean;
  v_overlap_eligible boolean;
  v_blocking_reasons jsonb;
  v_warnings jsonb;
  v_information jsonb;
  v_preferred_schedule text;
begin
  select w.branch_id
  into v_worker_branch_id
  from public.workers as w
  where w.id = p_worker_id;

  select p.branch_id
  into v_shift_branch_id
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as p on p.id = j.project_id
  where ss.id = p_shift_id;

  -- Candidate evaluation is an Admin read. Re-authorize both source objects
  -- before invoking either canonical fact reader.
  if v_worker_branch_id is null
    or v_shift_branch_id is null
    or not private.is_active_admin()
    or not private.has_branch_access(v_worker_branch_id)
    or not private.has_branch_access(v_shift_branch_id) then
    return jsonb_build_object(
      'ok', true,
      'sourceAvailable', false,
      'candidateEligible', false,
      'blockingReasons', '[]'::jsonb,
      'warnings', '[]'::jsonb,
      'information', '[]'::jsonb
    );
  end if;

  v_requirement_facts := public.get_worker_shift_requirement_facts(
    p_worker_id,
    p_shift_id
  );
  v_availability_facts := public.get_worker_shift_availability_facts(
    p_worker_id,
    p_shift_id
  );

  if not coalesce((v_requirement_facts ->> 'sourceAvailable')::boolean, false)
    or not coalesce((v_availability_facts ->> 'sourceAvailable')::boolean, false) then
    return jsonb_build_object(
      'ok', true,
      'sourceAvailable', false,
      'candidateEligible', false,
      'blockingReasons', '[]'::jsonb,
      'warnings', '[]'::jsonb,
      'information', '[]'::jsonb
    );
  end if;

  v_worker_status_eligible :=
    (v_availability_facts ->> 'workerStatusEligible')::boolean;
  v_requirements_eligible :=
    (v_requirement_facts ->> 'requirementsEligible')::boolean;
  v_availability_eligible :=
    (v_availability_facts ->> 'availabilityEligible')::boolean;
  v_overlap_eligible :=
    (v_availability_facts ->> 'overlapEligible')::boolean;
  v_preferred_schedule :=
    v_availability_facts #>> '{preferenceMatches,preferredSchedule}';

  with reason_catalog(code, category, classification, label, sort_order) as (
    values
      ('worker_inactive', 'worker_status', 'blocking', 'スタッフが無効です', 10),
      ('worker_suspended', 'worker_status', 'blocking', 'スタッフが停止中です', 20),
      ('requirement_master_inactive', 'requirement', 'blocking', '要件マスタが無効です', 30),
      ('skill_missing', 'requirement', 'blocking', '必須スキルが不足しています', 40),
      ('qualification_missing', 'requirement', 'blocking', '必須資格が不足しています', 50),
      ('qualification_not_yet_valid', 'requirement', 'blocking', '資格がまだ有効ではありません', 60),
      ('qualification_expired', 'requirement', 'blocking', '資格の有効期限が切れています', 70),
      ('qualification_revoked', 'requirement', 'blocking', '資格が失効しています', 80),
      ('availability_unavailable', 'availability', 'blocking', '勤務不可時間と重なっています', 90),
      ('assignment_time_conflict', 'assignment_overlap', 'blocking', '別の勤務と時間が重なっています', 100)
  ), active_codes as (
    select value as code
    from jsonb_array_elements_text(
      coalesce(v_availability_facts -> 'workerStatusReasonCodes', '[]'::jsonb)
      || coalesce(v_requirement_facts -> 'reasonCodes', '[]'::jsonb)
      || coalesce(v_availability_facts -> 'availabilityReasonCodes', '[]'::jsonb)
      || coalesce(v_availability_facts -> 'overlapReasonCodes', '[]'::jsonb)
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', catalog.code,
    'category', catalog.category,
    'classification', catalog.classification,
    'label', catalog.label
  ) order by catalog.sort_order), '[]'::jsonb)
  into v_blocking_reasons
  from reason_catalog as catalog
  where catalog.code in (select active_codes.code from active_codes);

  with reason_catalog(code, category, classification, label, sort_order) as (
    values
      ('availability_consultation_required', 'availability', 'warning', '勤務可否の確認が必要です', 110),
      ('availability_partially_confirmed', 'availability', 'warning', '勤務可能時間が一部のみ確認されています', 120),
      ('availability_unknown', 'availability', 'warning', '勤務可否が未登録です', 130),
      ('preferred_time_partially_matched', 'preference', 'warning', '希望時間と一部だけ一致します', 140),
      ('preferred_time_not_matched', 'preference', 'warning', '希望時間と一致しません', 150)
  ), active_codes as (
    select value as code
    from jsonb_array_elements_text(
      coalesce(v_availability_facts -> 'availabilityReasonCodes', '[]'::jsonb)
      || case v_preferred_schedule
        when 'partially_matched' then jsonb_build_array('preferred_time_partially_matched')
        when 'not_matched' then jsonb_build_array('preferred_time_not_matched')
        else '[]'::jsonb
      end
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', catalog.code,
    'category', catalog.category,
    'classification', catalog.classification,
    'label', catalog.label
  ) order by catalog.sort_order), '[]'::jsonb)
  into v_warnings
  from reason_catalog as catalog
  where catalog.code in (select active_codes.code from active_codes);

  with reason_catalog(code, category, classification, label, sort_order) as (
    values
      ('availability_confirmed', 'availability', 'informational', '勤務可能時間が確認済みです', 210),
      ('preferred_time_matched', 'preference', 'informational', '希望時間と一致します', 220),
      ('preference_not_configured', 'preference', 'informational', '希望時間は未設定です', 230)
  ), active_codes as (
    select value as code
    from jsonb_array_elements_text(
      coalesce(v_availability_facts -> 'availabilityReasonCodes', '[]'::jsonb)
      || case v_preferred_schedule
        when 'matched' then jsonb_build_array('preferred_time_matched')
        when 'not_configured' then jsonb_build_array('preference_not_configured')
        else '[]'::jsonb
      end
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', catalog.code,
    'category', catalog.category,
    'classification', catalog.classification,
    'label', catalog.label
  ) order by catalog.sort_order), '[]'::jsonb)
  into v_information
  from reason_catalog as catalog
  where catalog.code in (select active_codes.code from active_codes);

  return jsonb_build_object(
    'ok', true,
    'sourceAvailable', true,
    'workerId', p_worker_id,
    'shiftId', p_shift_id,
    'candidateEligible',
      v_worker_status_eligible
      and v_requirements_eligible
      and v_availability_eligible
      and v_overlap_eligible,
    'eligibilityScope', 'implemented_hard_rules_only',
    'workerStatusEligible', v_worker_status_eligible,
    'requirementsEligible', v_requirements_eligible,
    'availabilityEligible', v_availability_eligible,
    'overlapEligible', v_overlap_eligible,
    'workerStatus', v_availability_facts -> 'workerStatus',
    'evaluatedInterval', v_availability_facts -> 'evaluatedInterval',
    'requirementReasonCodes', v_requirement_facts -> 'reasonCodes',
    'requirements', v_requirement_facts -> 'requirements',
    'requirementEvaluationDate', v_requirement_facts -> 'evaluationDate',
    'availabilityState', v_availability_facts -> 'availabilityState',
    'availabilityCoverage', v_availability_facts -> 'availabilityCoverage',
    'availabilityReasonCodes', v_availability_facts -> 'availabilityReasonCodes',
    'overlapReasonCodes', v_availability_facts -> 'overlapReasonCodes',
    'conflictingAssignments', v_availability_facts -> 'conflictingAssignments',
    'preferenceMatches', v_availability_facts -> 'preferenceMatches',
    'blockingReasons', v_blocking_reasons,
    'warnings', v_warnings,
    'information', v_information
  );
end;
$$;

alter function public.get_worker_shift_candidate_eligibility(uuid, uuid)
  owner to postgres;

revoke all on function public.get_worker_shift_candidate_eligibility(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_worker_shift_candidate_eligibility(uuid, uuid)
  to authenticated;
