-- OCV1-02B QA: keep pagination metadata inside the candidate CTE statement.

create or replace function public.get_own_recruitment_shifts(
  p_limit integer default 24,
  p_offset integer default 0,
  p_shift_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_worker_id uuid := private.current_worker_id();
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 48));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_items jsonb;
  v_has_more boolean;
begin
  if (select auth.uid()) is null or v_worker_id is null then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb, 'hasMore', false);
  end if;

  with candidate as (
    select ss.id, ss.label, ss.starts_at, ss.ends_at, ss.meeting_at, ss.required_workers,
      coalesce(ss.application_deadline, ss.starts_at) as application_deadline,
      j.id as job_id, j.name as job_name, j.description, j.clothing_note, j.belongings_note,
      j.access_note, j.meeting_note, j.transport_type, j.transport_amount, j.transport_max_amount,
      j.hourly_wage, j.transportation_fee_cap, j.dress_code, j.requirements, j.meal_notes,
      j.recruitment_notes, j.manual_url, p.name as project_name,
      wp.name as workplace_name, wp.address as workplace_address, wp.access_note as workplace_access_note,
      wp.meeting_note as workplace_meeting_note, wp.map_url
    from public.shift_slots ss
    join public.jobs j on j.id = ss.job_id
    join public.projects p on p.id = j.project_id
    join public.workplaces wp on wp.id = j.workplace_id
    join public.workers w on w.id = v_worker_id and w.branch_id = p.branch_id
    where p.status = 'recruiting' and ss.status = 'recruiting' and ss.starts_at > now()
      and (p_shift_id is null or ss.id = p_shift_id)
      and not exists (select 1 from public.assignments own where own.shift_slot_id = ss.id and own.worker_id = v_worker_id and own.status in ('assigned','confirmed','completed'))
    order by ss.starts_at, ss.id
    limit v_limit + 1 offset v_offset
  ), shaped as (
    select c.*, coalesce(cap.count, 0)::integer as active_assignments,
      app.status as application_status,
      public.get_worker_shift_availability_facts(v_worker_id, c.id) as availability,
      coalesce((select jsonb_agg(jsonb_build_object('kind','skill','name',s.name) order by s.name)
        from public.job_skill_requirements r join public.skills s on s.id=r.skill_id where r.job_id=c.job_id), '[]'::jsonb) as required_skills,
      coalesce((select jsonb_agg(jsonb_build_object('kind','qualification','name',q.name) order by q.name)
        from public.job_qualification_requirements r join public.qualifications q on q.id=r.qualification_id where r.job_id=c.job_id), '[]'::jsonb) as required_qualifications,
      exists (select 1 from public.job_skill_requirements r join public.skills s on s.id=r.skill_id left join public.worker_skills ws on ws.worker_id=v_worker_id and ws.skill_id=r.skill_id and ws.is_active where r.job_id=c.job_id and (not s.is_active or ws.worker_id is null))
        or exists (select 1 from public.job_qualification_requirements r join public.qualifications q on q.id=r.qualification_id left join public.worker_qualifications wq on wq.worker_id=v_worker_id and wq.qualification_id=r.qualification_id where r.job_id=c.job_id and (not q.is_active or wq.worker_id is null or wq.revoked_at is not null or (wq.valid_from is not null and wq.valid_from > (c.starts_at at time zone 'Asia/Tokyo')::date) or (wq.expires_on is not null and wq.expires_on < (c.starts_at at time zone 'Asia/Tokyo')::date))) as requirement_blocked
    from candidate c
    left join lateral (select count(*) from public.assignments a where a.shift_slot_id=c.id and a.status in ('assigned','confirmed','completed')) cap on true
    left join public.shift_applications app on app.shift_slot_id=c.id and app.worker_id=v_worker_id
  ), rendered as (
    select s.*, greatest(s.required_workers - s.active_assignments, 0) as remaining_capacity,
      case
        when s.application_status='applied' then 'applied'
        when s.application_status='accepted' then 'accepted_waiting_assignment'
        when s.application_status='rejected' then 'rejected'
        when s.application_status='withdrawn' then 'withdrawn'
        when s.application_deadline <= now() then 'deadline_passed'
        when s.active_assignments >= s.required_workers then 'capacity_full'
        when s.requirement_blocked or coalesce((s.availability->>'workerStatusEligible')::boolean, false)=false or coalesce((s.availability->>'availabilityEligible')::boolean, false)=false or coalesce((s.availability->>'overlapEligible')::boolean, false)=false then 'not_eligible'
        when s.availability->>'availabilityState' in ('unknown','partially_available','consultation_required') then 'available_with_warning'
        else 'available' end as state
    from shaped s
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'shiftId', id, 'projectName', project_name, 'jobName', job_name, 'label', label,
    'startsAt', starts_at, 'endsAt', ends_at, 'meetingAt', meeting_at, 'applicationDeadline', application_deadline,
    'workplaceName', workplace_name, 'workplaceAddress', workplace_address, 'accessNote', coalesce(access_note, workplace_access_note),
    'meetingNote', coalesce(meeting_note, workplace_meeting_note), 'description', description,
    'clothingNote', coalesce(dress_code, clothing_note), 'belongingsNote', belongings_note, 'mealNotes', meal_notes,
    'hourlyWage', hourly_wage, 'transportationFeeCap', transportation_fee_cap, 'transportType', transport_type,
    'transportAmount', transport_amount, 'transportMaxAmount', transport_max_amount, 'recruitmentNotes', recruitment_notes,
    'manualUrl', manual_url, 'mapUrl', map_url, 'requirementsText', requirements,
    'requirements', required_skills || required_qualifications, 'remainingCapacity', remaining_capacity,
    'applicationState', application_status, 'state', state,
    'eligibility', jsonb_build_object('availabilityState', availability->>'availabilityState', 'safeReasons', case when requirement_blocked then jsonb_build_array('required_conditions_not_met') when coalesce((availability->>'overlapEligible')::boolean, true)=false then jsonb_build_array('other_scheduled_shift_overlaps') when coalesce((availability->>'availabilityEligible')::boolean, true)=false then jsonb_build_array('availability_unavailable') when availability->>'availabilityState' in ('unknown','partially_available','consultation_required') then jsonb_build_array('availability_needs_confirmation') else '[]'::jsonb end)
  )) order by starts_at, id), '[]'::jsonb),
    (select count(*) > v_limit from candidate)
  into v_items, v_has_more
  from (select * from rendered limit v_limit) r;

  return jsonb_build_object('ok', true, 'items', v_items, 'hasMore', v_has_more);
end;
$$;

alter function public.get_own_recruitment_shifts(integer, integer, uuid) owner to postgres;
revoke all on function public.get_own_recruitment_shifts(integer, integer, uuid) from public, anon, service_role;
grant execute on function public.get_own_recruitment_shifts(integer, integer, uuid) to authenticated;
