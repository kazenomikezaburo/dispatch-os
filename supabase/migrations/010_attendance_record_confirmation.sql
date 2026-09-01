-- Confirm an immutable attendance record and complete its assignment atomically.

alter table public.attendance_records
  add column adjustment_reason text;

-- Attendance confirmation and later corrections are restricted to RPCs.
drop policy "Managers can create branch attendance records"
on public.attendance_records;

drop policy "Managers can update branch attendance records"
on public.attendance_records;

drop policy "System admins can create attendance records"
on public.attendance_records;

drop policy "System admins can update attendance records"
on public.attendance_records;

create function public.confirm_attendance_record(
  p_assignment_id uuid,
  p_actual_start_at timestamptz,
  p_actual_end_at timestamptz,
  p_break_minutes integer,
  p_adjustment_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_account_type text;
  v_assignment_status text;
  v_shift_id uuid;
  v_planned_start_at timestamptz;
  v_planned_end_at timestamptz;
  v_planned_break_minutes integer;
  v_branch_id uuid;
  v_start_event_at timestamptz;
  v_end_event_at timestamptz;
  v_start_count integer;
  v_end_count integer;
  v_duration_minutes numeric;
  v_reason text := nullif(btrim(p_adjustment_reason), '');
  v_record_id uuid;
  v_approved_at timestamptz;
begin
  select p.account_type
  into v_account_type
  from public.profiles as p
  where p.id = v_actor_id and p.is_active = true;

  if v_account_type is null or v_account_type not in ('manager', 'system_admin') then
    raise exception using errcode = '42501', message = 'attendance_confirmation_forbidden';
  end if;

  select a.status, a.shift_slot_id
  into v_assignment_status, v_shift_id
  from public.assignments as a
  where a.id = p_assignment_id
  for update of a;

  if not found then
    raise exception using errcode = 'P0002', message = 'attendance_assignment_not_found';
  end if;

  select ss.starts_at, ss.ends_at, coalesce(ss.break_minutes, 0), pr.branch_id
  into v_planned_start_at, v_planned_end_at, v_planned_break_minutes, v_branch_id
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as pr on pr.id = j.project_id
  where ss.id = v_shift_id;

  if not found or not private.has_branch_access(v_branch_id) then
    raise exception using errcode = '42501', message = 'attendance_confirmation_forbidden';
  end if;

  if exists (select 1 from public.attendance_records as ar where ar.assignment_id = p_assignment_id) then
    raise exception using errcode = '23505', message = 'attendance_already_confirmed';
  end if;

  if v_assignment_status not in ('assigned', 'confirmed') then
    raise exception using errcode = '22023', message = 'attendance_confirmation_invalid_state';
  end if;

  select
    count(*) filter (where e.event_type = 'start_work'),
    count(*) filter (where e.event_type = 'end_work'),
    min(e.server_received_at) filter (where e.event_type = 'start_work'),
    min(e.server_received_at) filter (where e.event_type = 'end_work')
  into v_start_count, v_end_count, v_start_event_at, v_end_event_at
  from public.attendance_events as e
  where e.assignment_id = p_assignment_id
    and e.event_type in ('start_work', 'end_work');

  if v_start_count > 1 or v_end_count > 1 or (v_start_count = 0 and v_end_count > 0) then
    raise exception using errcode = '23514', message = 'attendance_event_structure_invalid';
  end if;

  if p_actual_start_at is null or p_actual_end_at is null or p_actual_end_at <= p_actual_start_at then
    raise exception using errcode = '23514', message = 'attendance_actual_times_invalid';
  end if;

  v_duration_minutes := extract(epoch from (p_actual_end_at - p_actual_start_at)) / 60;
  if p_break_minutes is null or p_break_minutes < 0 or p_break_minutes > 32767 or p_break_minutes > v_duration_minutes then
    raise exception using errcode = '23514', message = 'attendance_break_invalid';
  end if;

  if v_reason is null and (
    v_start_event_at is null
    or v_end_event_at is null
    or p_actual_start_at <> v_start_event_at
    or p_actual_end_at <> v_end_event_at
    or p_break_minutes <> v_planned_break_minutes
  ) then
    raise exception using errcode = '23514', message = 'attendance_adjustment_reason_required';
  end if;

  v_approved_at := clock_timestamp();
  insert into public.attendance_records (
    assignment_id, planned_start_at, planned_end_at,
    actual_start_at, actual_end_at, total_break_minutes,
    status, approved_at, approved_by, adjustment_reason
  ) values (
    p_assignment_id, v_planned_start_at, v_planned_end_at,
    p_actual_start_at, p_actual_end_at, p_break_minutes,
    'approved', v_approved_at, v_actor_id, v_reason
  ) returning id into v_record_id;

  update public.assignments set status = 'completed' where id = p_assignment_id;
  return v_record_id;
end;
$$;

alter function public.confirm_attendance_record(uuid, timestamptz, timestamptz, integer, text)
  owner to postgres;
revoke all on function public.confirm_attendance_record(uuid, timestamptz, timestamptz, integer, text) from public;
revoke all on function public.confirm_attendance_record(uuid, timestamptz, timestamptz, integer, text) from anon;
grant execute on function public.confirm_attendance_record(uuid, timestamptz, timestamptz, integer, text) to authenticated;
