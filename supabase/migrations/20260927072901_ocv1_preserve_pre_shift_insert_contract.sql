-- OCV1-04B: preserve the existing Worker confirmation INSERT contract while
-- enforcing planned-time validity for every insert path.

create function private.validate_pre_shift_planned_times()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arrival_target timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if new.planned_wake_at is null and new.planned_departure_at is null then
    return new;
  end if;

  select coalesce(ss.meeting_at, ss.starts_at)
  into v_arrival_target
  from public.assignments as a
  join public.shift_slots as ss on ss.id = a.shift_slot_id
  where a.id = new.assignment_id;

  if v_arrival_target is null
     or (new.planned_wake_at is not null and (new.planned_wake_at <= v_now or new.planned_wake_at > v_arrival_target))
     or (new.planned_departure_at is not null and (new.planned_departure_at <= v_now or new.planned_departure_at > v_arrival_target))
     or (new.planned_wake_at is not null and new.planned_departure_at is not null and new.planned_departure_at < new.planned_wake_at) then
    raise exception using errcode = '23514', message = 'pre_shift_planned_time_invalid';
  end if;

  return new;
end;
$$;

create trigger validate_pre_shift_planned_times_before_insert
before insert on public.pre_shift_confirmations
for each row execute function private.validate_pre_shift_planned_times();

create policy "Workers can create own pre shift confirmations"
on public.pre_shift_confirmations for insert to authenticated
with check (private.worker_can_confirm_assignment(assignment_id));

grant insert on table public.pre_shift_confirmations to authenticated;

alter function private.validate_pre_shift_planned_times() owner to postgres;
revoke all on function private.validate_pre_shift_planned_times() from public;
revoke all on function private.validate_pre_shift_planned_times() from anon;
revoke all on function private.validate_pre_shift_planned_times() from authenticated;
revoke all on function private.validate_pre_shift_planned_times() from service_role;
