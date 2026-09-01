-- Preserve every approved attendance correction and apply it atomically.

create table public.attendance_record_revisions (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete restrict,
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  before_actual_start_at timestamptz not null,
  before_actual_end_at timestamptz not null,
  before_break_minutes smallint not null,
  after_actual_start_at timestamptz not null,
  after_actual_end_at timestamptz not null,
  after_break_minutes smallint not null,
  reason text not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint attendance_record_revisions_before_times_check
    check (before_actual_end_at > before_actual_start_at),
  constraint attendance_record_revisions_after_times_check
    check (after_actual_end_at > after_actual_start_at),
  constraint attendance_record_revisions_before_break_check
    check (
      before_break_minutes >= 0
      and before_break_minutes <= extract(epoch from (before_actual_end_at - before_actual_start_at)) / 60
    ),
  constraint attendance_record_revisions_after_break_check
    check (
      after_break_minutes >= 0
      and after_break_minutes <= extract(epoch from (after_actual_end_at - after_actual_start_at)) / 60
    ),
  constraint attendance_record_revisions_changed_check
    check (
      before_actual_start_at <> after_actual_start_at
      or before_actual_end_at <> after_actual_end_at
      or before_break_minutes <> after_break_minutes
    ),
  constraint attendance_record_revisions_reason_check
    check (reason = btrim(reason) and char_length(reason) between 1 and 500)
);

create index attendance_record_revisions_record_changed_idx
  on public.attendance_record_revisions (attendance_record_id, changed_at desc, id desc);
create index attendance_record_revisions_assignment_idx
  on public.attendance_record_revisions (assignment_id);

alter table public.attendance_record_revisions enable row level security;

create policy "Managers can view branch attendance revisions"
on public.attendance_record_revisions for select to authenticated
using (
  not private.is_system_admin()
  and private.has_assignment_branch_access(assignment_id)
);

create policy "System admins can view attendance revisions"
on public.attendance_record_revisions for select to authenticated
using (private.is_system_admin());

revoke all privileges on table public.attendance_record_revisions from anon;
revoke all privileges on table public.attendance_record_revisions from authenticated;
grant select on table public.attendance_record_revisions to authenticated;

create function public.revise_attendance_record(
  p_assignment_id uuid,
  p_actual_start_at timestamptz,
  p_actual_end_at timestamptz,
  p_break_minutes integer,
  p_reason text
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
  v_record_id uuid;
  v_before_start timestamptz;
  v_before_end timestamptz;
  v_before_break smallint;
  v_reason text := btrim(p_reason);
  v_duration_minutes numeric;
  v_revision_id uuid;
begin
  select p.account_type
  into v_account_type
  from public.profiles as p
  where p.id = v_actor_id and p.is_active = true;

  if v_account_type is null or v_account_type not in ('manager', 'system_admin') then
    raise exception using errcode = '42501', message = 'attendance_revision_forbidden';
  end if;

  select
    ar.id,
    ar.actual_start_at,
    ar.actual_end_at,
    ar.total_break_minutes,
    a.status
  into
    v_record_id,
    v_before_start,
    v_before_end,
    v_before_break,
    v_assignment_status
  from public.attendance_records as ar
  join public.assignments as a on a.id = ar.assignment_id
  where ar.assignment_id = p_assignment_id
  for update of ar;

  if not found then
    raise exception using errcode = 'P0002', message = 'attendance_record_not_found';
  end if;

  if not private.has_assignment_branch_access(p_assignment_id) then
    raise exception using errcode = '42501', message = 'attendance_revision_forbidden';
  end if;

  if v_assignment_status <> 'completed' then
    raise exception using errcode = '22023', message = 'attendance_revision_invalid_state';
  end if;

  if v_before_start is null
    or v_before_end is null
    or v_before_break is null then
    raise exception using errcode = '23514', message = 'attendance_record_incomplete';
  end if;

  if p_actual_start_at is null or p_actual_end_at is null or p_actual_end_at <= p_actual_start_at then
    raise exception using errcode = '23514', message = 'attendance_revision_times_invalid';
  end if;

  v_duration_minutes := extract(epoch from (p_actual_end_at - p_actual_start_at)) / 60;
  if p_break_minutes is null or p_break_minutes < 0 or p_break_minutes > 32767 or p_break_minutes > v_duration_minutes then
    raise exception using errcode = '23514', message = 'attendance_revision_break_invalid';
  end if;

  if v_reason is null or char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '23514', message = 'attendance_revision_reason_invalid';
  end if;

  if v_before_start = p_actual_start_at
    and v_before_end = p_actual_end_at
    and v_before_break = p_break_minutes then
    raise exception using errcode = '23514', message = 'attendance_revision_no_change';
  end if;

  insert into public.attendance_record_revisions (
    attendance_record_id,
    assignment_id,
    before_actual_start_at,
    before_actual_end_at,
    before_break_minutes,
    after_actual_start_at,
    after_actual_end_at,
    after_break_minutes,
    reason,
    changed_by,
    changed_at
  ) values (
    v_record_id,
    p_assignment_id,
    v_before_start,
    v_before_end,
    v_before_break,
    p_actual_start_at,
    p_actual_end_at,
    p_break_minutes,
    v_reason,
    v_actor_id,
    clock_timestamp()
  ) returning id into v_revision_id;

  update public.attendance_records
  set
    actual_start_at = p_actual_start_at,
    actual_end_at = p_actual_end_at,
    total_break_minutes = p_break_minutes
  where id = v_record_id;

  return v_revision_id;
end;
$$;

alter function public.revise_attendance_record(uuid, timestamptz, timestamptz, integer, text)
  owner to postgres;
revoke all on function public.revise_attendance_record(uuid, timestamptz, timestamptz, integer, text) from public;
revoke all on function public.revise_attendance_record(uuid, timestamptz, timestamptz, integer, text) from anon;
grant execute on function public.revise_attendance_record(uuid, timestamptz, timestamptz, integer, text) to authenticated;
