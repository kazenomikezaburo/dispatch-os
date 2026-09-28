-- OCV1-06: authorized, bounded canonical journey facts for derived Admin attention.

create function public.get_admin_assignment_journey_facts(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 500
)
returns table (
  assignment_id uuid,
  shift_id uuid,
  branch_id uuid,
  worker_id uuid,
  worker_name text,
  staff_code text,
  project_id uuid,
  project_name text,
  job_id uuid,
  job_name text,
  workplace_name text,
  generated_at timestamptz,
  assignment_status text,
  shift_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  arrival_target timestamptz,
  has_confirmation boolean,
  confirmation_submitted_at timestamptz,
  planned_wake_at timestamptz,
  planned_departure_at timestamptz,
  wake_operation text,
  wake_occurred_at timestamptz,
  wake_timeliness text,
  departure_operation text,
  departure_occurred_at timestamptz,
  departure_timeliness text,
  arrival_operation text,
  arrival_occurred_at timestamptz,
  arrival_timeliness text,
  start_work_at timestamptz,
  end_work_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select profile.account_type
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and profile.account_type in ('manager', 'system_admin')
  )
  select
    assignment.id,
    shift.id,
    project.branch_id,
    worker.id,
    worker.display_name,
    worker.staff_code,
    project.id,
    project.name,
    job.id,
    job.name,
    workplace.name,
    statement_timestamp(),
    assignment.status,
    shift.status,
    shift.starts_at,
    shift.ends_at,
    coalesce(shift.meeting_at, shift.starts_at),
    confirmation.assignment_id is not null,
    confirmation.submitted_at,
    confirmation.planned_wake_at,
    confirmation.planned_departure_at,
    wake.operation,
    wake.occurred_at,
    wake.timeliness,
    departure.operation,
    departure.occurred_at,
    departure.timeliness,
    arrival.operation,
    arrival.occurred_at,
    arrival.timeliness,
    attendance.start_work_at,
    attendance.end_work_at
  from actor
  join public.assignments as assignment on true
  join public.workers as worker on worker.id = assignment.worker_id
  join public.shift_slots as shift on shift.id = assignment.shift_slot_id
  join public.jobs as job on job.id = shift.job_id
  join public.projects as project on project.id = job.project_id
  join public.workplaces as workplace on workplace.id = job.workplace_id
  left join public.pre_shift_confirmations as confirmation
    on confirmation.assignment_id = assignment.id
  left join lateral (
    select event.operation, event.occurred_at, event.timeliness
    from public.assignment_journey_event_versions as event
    where event.assignment_id = assignment.id and event.journey_type = 'wake'
    order by event.version desc
    limit 1
  ) as wake on true
  left join lateral (
    select event.operation, event.occurred_at, event.timeliness
    from public.assignment_journey_event_versions as event
    where event.assignment_id = assignment.id and event.journey_type = 'departure'
    order by event.version desc
    limit 1
  ) as departure on true
  left join lateral (
    select event.operation, event.occurred_at, event.timeliness
    from public.assignment_journey_event_versions as event
    where event.assignment_id = assignment.id and event.journey_type = 'arrival'
    order by event.version desc
    limit 1
  ) as arrival on true
  left join lateral (
    select
      min(event.server_received_at) filter (where event.event_type = 'start_work') as start_work_at,
      min(event.server_received_at) filter (where event.event_type = 'end_work') as end_work_at
    from public.attendance_events as event
    where event.assignment_id = assignment.id
  ) as attendance on true
  where p_from is not null
    and p_to is not null
    and p_to > p_from
    and p_limit between 1 and 500
    and shift.starts_at >= p_from
    and shift.starts_at < p_to
    and (
      actor.account_type = 'system_admin'
      or private.has_branch_access(project.branch_id)
    )
  order by shift.starts_at, assignment.id
  limit p_limit;
$$;

alter function public.get_admin_assignment_journey_facts(timestamptz, timestamptz, integer) owner to postgres;
revoke all on function public.get_admin_assignment_journey_facts(timestamptz, timestamptz, integer) from public;
revoke all on function public.get_admin_assignment_journey_facts(timestamptz, timestamptz, integer) from anon;
revoke all on function public.get_admin_assignment_journey_facts(timestamptz, timestamptz, integer) from authenticated;
revoke all on function public.get_admin_assignment_journey_facts(timestamptz, timestamptz, integer) from service_role;
grant execute on function public.get_admin_assignment_journey_facts(timestamptz, timestamptz, integer) to authenticated;

comment on function public.get_admin_assignment_journey_facts(timestamptz, timestamptz, integer) is
  'OCV1-06 bounded, branch-authorized current journey facts for derived Admin attention. No raw history or mutation.';
