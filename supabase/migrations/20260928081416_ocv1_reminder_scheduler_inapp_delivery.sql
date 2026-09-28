-- OCV1-07A: bounded canonical reminder evaluation and in-app projection only.

create function private.worker_journey_timing_policy()
returns table (
  journey_type text,
  open_before interval,
  overdue_after interval
)
language sql
immutable
security definer
set search_path = ''
as $$
  values
    ('wake'::text, interval '6 hours', interval '15 minutes'),
    ('departure'::text, interval '2 hours', interval '10 minutes'),
    ('arrival'::text, interval '3 hours', interval '5 minutes');
$$;

create table private.scheduled_worker_reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  recipient_profile_id uuid not null,
  reminder_type text not null,
  phase text not null,
  eligible_at timestamptz not null,
  due_at timestamptz not null,
  notification_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint scheduled_worker_reminder_occurrences_recipient_fkey
    foreign key (recipient_profile_id) references public.profiles(id) on delete restrict,
  constraint scheduled_worker_reminder_occurrences_type_check
    check (reminder_type in ('pre_confirmation_reminder','wake_reminder','departure_reminder','arrival_reminder')),
  constraint scheduled_worker_reminder_occurrences_phase_check
    check (
      (reminder_type = 'pre_confirmation_reminder' and phase = 'approaching')
      or (reminder_type <> 'pre_confirmation_reminder' and phase in ('approaching','overdue'))
    ),
  constraint scheduled_worker_reminder_occurrences_logical_key
    unique (assignment_id, reminder_type, phase),
  constraint scheduled_worker_reminder_occurrences_source_key
    unique (id, reminder_type),
  constraint scheduled_worker_reminder_occurrences_notification_key
    unique (notification_id)
);

alter table private.scheduled_worker_reminder_occurrences enable row level security;
revoke all privileges on table private.scheduled_worker_reminder_occurrences from public,anon,authenticated,service_role;

alter table public.in_app_notifications
  add column source_scheduled_worker_reminder_id uuid,
  drop constraint in_app_notifications_type_check,
  drop constraint in_app_notifications_source_shape_check,
  add constraint in_app_notifications_type_check check (
    notification_type in (
      'incident_acknowledged','incident_resolved','announcement_published','pre_confirmation_reminder',
      'wake_reminder','departure_reminder','arrival_reminder'
    )
  ),
  add constraint in_app_notifications_source_shape_check check (
    (
      notification_type in ('incident_acknowledged','incident_resolved')
      and source_incident_event_id is not null and source_announcement_id is null
      and source_pre_confirmation_reminder_id is null and source_scheduled_worker_reminder_id is null
    ) or (
      notification_type = 'announcement_published'
      and source_incident_event_id is null and source_announcement_id is not null
      and source_pre_confirmation_reminder_id is null and source_scheduled_worker_reminder_id is null
    ) or (
      notification_type = 'pre_confirmation_reminder'
      and source_incident_event_id is null and source_announcement_id is null
      and ((source_pre_confirmation_reminder_id is not null)::integer + (source_scheduled_worker_reminder_id is not null)::integer) = 1
    ) or (
      notification_type in ('wake_reminder','departure_reminder','arrival_reminder')
      and source_incident_event_id is null and source_announcement_id is null
      and source_pre_confirmation_reminder_id is null and source_scheduled_worker_reminder_id is not null
    )
  ),
  add constraint in_app_notifications_scheduled_worker_source_fkey
    foreign key (source_scheduled_worker_reminder_id,notification_type)
    references private.scheduled_worker_reminder_occurrences(id,reminder_type)
    on delete restrict
    deferrable initially deferred;

create unique index in_app_notifications_scheduled_worker_recipient_key
  on public.in_app_notifications(source_scheduled_worker_reminder_id,recipient_profile_id)
  where source_scheduled_worker_reminder_id is not null;

alter table private.scheduled_worker_reminder_occurrences
  add constraint scheduled_worker_reminder_occurrences_notification_fkey
  foreign key (notification_id) references public.in_app_notifications(id)
  on delete restrict deferrable initially deferred;

create index scheduled_worker_reminder_occurrences_cooldown_idx
  on private.scheduled_worker_reminder_occurrences(assignment_id,reminder_type,created_at desc);

create function private.evaluate_worker_reminders(
  p_now timestamptz default clock_timestamp(),
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evaluated integer := 0;
  v_projected integer := 0;
begin
  if p_now is null or p_limit is null or p_limit < 1 or p_limit > 500 then
    return jsonb_build_object('ok',false,'code','INVALID_INPUT');
  end if;

  with policy as (
    select * from private.worker_journey_timing_policy()
  ),
  facts as (
    select
      assignment.id as assignment_id,
      worker.auth_profile_id as recipient_profile_id,
      shift.starts_at,
      shift.ends_at,
      coalesce(shift.meeting_at,shift.starts_at) as arrival_target,
      confirmation.id is not null as has_confirmation,
      confirmation.planned_wake_at,
      confirmation.planned_departure_at,
      wake.operation as wake_operation,
      departure.operation as departure_operation,
      arrival.operation as arrival_operation,
      attendance.start_work_at
    from public.assignments as assignment
    join public.shift_slots as shift on shift.id=assignment.shift_slot_id
    join public.workers as worker on worker.id=assignment.worker_id and worker.status='active'
    join public.profiles as profile on profile.id=worker.auth_profile_id and profile.is_active=true and profile.account_type='worker'
    left join public.pre_shift_confirmations as confirmation on confirmation.assignment_id=assignment.id
    left join lateral (
      select event.operation from public.assignment_journey_event_versions as event
      where event.assignment_id=assignment.id and event.journey_type='wake'
      order by event.version desc limit 1
    ) as wake on true
    left join lateral (
      select event.operation from public.assignment_journey_event_versions as event
      where event.assignment_id=assignment.id and event.journey_type='departure'
      order by event.version desc limit 1
    ) as departure on true
    left join lateral (
      select event.operation from public.assignment_journey_event_versions as event
      where event.assignment_id=assignment.id and event.journey_type='arrival'
      order by event.version desc limit 1
    ) as arrival on true
    left join lateral (
      select min(event.server_received_at) filter(where event.event_type='start_work') as start_work_at
      from public.attendance_events as event where event.assignment_id=assignment.id
    ) as attendance on true
    where assignment.status in ('assigned','confirmed')
      and shift.status <> 'cancelled'
      and p_now < shift.ends_at
      and shift.starts_at < p_now + interval '2 days'
  ),
  raw_candidates as (
    select facts.assignment_id,facts.recipient_profile_id,'pre_confirmation_reminder'::text as reminder_type,
      'approaching'::text as phase,
      ((pg_catalog.date_trunc('day',facts.starts_at at time zone 'Asia/Tokyo')-interval '1 day') at time zone 'Asia/Tokyo') as eligible_at,
      facts.starts_at as due_at
    from facts
    where not facts.has_confirmation
      and p_now >= ((pg_catalog.date_trunc('day',facts.starts_at at time zone 'Asia/Tokyo')-interval '1 day') at time zone 'Asia/Tokyo')
      and p_now < facts.starts_at
    union all
    select facts.assignment_id,facts.recipient_profile_id,'wake_reminder',
      case when p_now >= facts.planned_wake_at+policy.overdue_after then 'overdue' else 'approaching' end,
      case when p_now >= facts.planned_wake_at+policy.overdue_after then facts.planned_wake_at+policy.overdue_after else facts.planned_wake_at-policy.open_before end,
      facts.planned_wake_at
    from facts join policy on policy.journey_type='wake'
    where facts.has_confirmation and facts.planned_wake_at is not null
      and facts.wake_operation is distinct from 'recorded'
      and facts.arrival_operation is distinct from 'recorded' and facts.start_work_at is null
      and p_now >= facts.planned_wake_at-policy.open_before
    union all
    select facts.assignment_id,facts.recipient_profile_id,'departure_reminder',
      case when p_now >= facts.planned_departure_at+policy.overdue_after then 'overdue' else 'approaching' end,
      case when p_now >= facts.planned_departure_at+policy.overdue_after then facts.planned_departure_at+policy.overdue_after else facts.planned_departure_at-policy.open_before end,
      facts.planned_departure_at
    from facts join policy on policy.journey_type='departure'
    where facts.has_confirmation and facts.planned_departure_at is not null
      and facts.departure_operation is distinct from 'recorded'
      and facts.arrival_operation is distinct from 'recorded' and facts.start_work_at is null
      and p_now >= facts.planned_departure_at-policy.open_before
    union all
    select facts.assignment_id,facts.recipient_profile_id,'arrival_reminder',
      case when p_now >= facts.arrival_target+policy.overdue_after then 'overdue' else 'approaching' end,
      case when p_now >= facts.arrival_target+policy.overdue_after then facts.arrival_target+policy.overdue_after else facts.arrival_target-policy.open_before end,
      facts.arrival_target
    from facts join policy on policy.journey_type='arrival'
    where facts.has_confirmation
      and facts.arrival_operation is distinct from 'recorded' and facts.start_work_at is null
      and p_now >= facts.arrival_target-policy.open_before
  ),
  candidates as (
    select candidate.*
    from raw_candidates as candidate
    where not exists (
      select 1 from private.scheduled_worker_reminder_occurrences as existing
      where existing.assignment_id=candidate.assignment_id
        and existing.reminder_type=candidate.reminder_type and existing.phase=candidate.phase
    )
      and not exists (
        select 1 from private.scheduled_worker_reminder_occurrences as recent
        where recent.assignment_id=candidate.assignment_id and recent.reminder_type=candidate.reminder_type
          and recent.created_at>p_now-interval '15 minutes'
      )
      and not (
        candidate.reminder_type='pre_confirmation_reminder' and exists (
          select 1 from private.pre_confirmation_reminder_occurrences as admin_occurrence
          where admin_occurrence.assignment_id=candidate.assignment_id and admin_occurrence.outcome='projected'
            and admin_occurrence.requested_at>p_now-interval '15 minutes'
        )
      )
    order by candidate.eligible_at,candidate.assignment_id,candidate.reminder_type
    limit p_limit
  ),
  inserted_occurrences as (
    insert into private.scheduled_worker_reminder_occurrences(
      assignment_id,recipient_profile_id,reminder_type,phase,eligible_at,due_at,notification_id,created_at
    )
    select candidate.assignment_id,candidate.recipient_profile_id,candidate.reminder_type,candidate.phase,
      candidate.eligible_at,candidate.due_at,gen_random_uuid(),p_now
    from candidates as candidate
    on conflict (assignment_id,reminder_type,phase) do nothing
    returning *
  ),
  inserted_notifications as (
    insert into public.in_app_notifications(
      id,recipient_profile_id,notification_type,source_incident_event_id,source_announcement_id,
      source_pre_confirmation_reminder_id,source_scheduled_worker_reminder_id,title,summary,created_at
    )
    select occurrence.notification_id,occurrence.recipient_profile_id,occurrence.reminder_type,null,null,null,occurrence.id,
      case occurrence.reminder_type
        when 'pre_confirmation_reminder' then '勤務前確認の回答をお願いします'
        when 'wake_reminder' then '起床報告を確認してください'
        when 'departure_reminder' then '出発報告を確認してください'
        else '到着報告を確認してください'
      end,
      case
        when occurrence.reminder_type='pre_confirmation_reminder' then '勤務前確認が未回答です。勤務詳細から回答してください。'
        when occurrence.reminder_type='wake_reminder' and occurrence.phase='overdue' then '起床報告が未完了です。勤務詳細から報告してください。'
        when occurrence.reminder_type='wake_reminder' then '起床報告の時間が近づいています。勤務詳細を確認してください。'
        when occurrence.reminder_type='departure_reminder' and occurrence.phase='overdue' then '出発報告が未完了です。勤務詳細から報告してください。'
        when occurrence.reminder_type='departure_reminder' then '出発報告の時間が近づいています。勤務詳細を確認してください。'
        when occurrence.phase='overdue' then '到着報告が未完了です。勤務詳細から報告してください。'
        else '集合時刻が近づいています。勤務詳細を確認してください。'
      end,
      p_now
    from inserted_occurrences as occurrence
    returning id
  )
  select (select count(*) from candidates),(select count(*) from inserted_notifications)
  into v_evaluated,v_projected;

  return jsonb_build_object('ok',true,'evaluated',v_evaluated,'projected',v_projected,'limit',p_limit);
end;
$$;

create or replace function public.resolve_pre_confirmation_reminder_source_context(p_notification_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_assignment_id uuid;
begin
  if p_notification_id is null or v_actor_id is null then
    return jsonb_build_object('ok',true,'source_available',false,'assignment_id',null);
  end if;

  select candidate.assignment_id into v_assignment_id
  from (
    select occurrence.assignment_id
    from public.in_app_notifications as notification
    join private.pre_confirmation_reminder_occurrences as occurrence on occurrence.id=notification.source_pre_confirmation_reminder_id
    where notification.id=p_notification_id and notification.notification_type='pre_confirmation_reminder'
      and notification.source_scheduled_worker_reminder_id is null
      and occurrence.outcome='projected' and occurrence.notification_id=notification.id
      and occurrence.recipient_profile_id=v_actor_id
    union all
    select occurrence.assignment_id
    from public.in_app_notifications as notification
    join private.scheduled_worker_reminder_occurrences as occurrence on occurrence.id=notification.source_scheduled_worker_reminder_id
    where notification.id=p_notification_id and notification.notification_type='pre_confirmation_reminder'
      and notification.source_pre_confirmation_reminder_id is null
      and occurrence.reminder_type='pre_confirmation_reminder' and occurrence.notification_id=notification.id
      and occurrence.recipient_profile_id=v_actor_id
  ) as candidate
  join public.assignments as assignment on assignment.id=candidate.assignment_id
  join public.workers as worker on worker.id=assignment.worker_id
  join public.profiles as profile on profile.id=worker.auth_profile_id
  where profile.id=v_actor_id and profile.is_active=true and profile.account_type='worker'
    and worker.status='active' and private.worker_owns_assignment(assignment.id)
  limit 1;

  return jsonb_build_object('ok',true,'source_available',v_assignment_id is not null,'assignment_id',v_assignment_id);
end;
$$;

create function public.resolve_worker_journey_reminder_source_context(p_notification_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_assignment_id uuid;
begin
  if p_notification_id is null or v_actor_id is null then
    return jsonb_build_object('ok',true,'source_available',false,'assignment_id',null);
  end if;
  select assignment.id into v_assignment_id
  from public.in_app_notifications as notification
  join private.scheduled_worker_reminder_occurrences as occurrence
    on occurrence.id=notification.source_scheduled_worker_reminder_id
   and occurrence.reminder_type=notification.notification_type
  join public.assignments as assignment on assignment.id=occurrence.assignment_id
  join public.workers as worker on worker.id=assignment.worker_id
  join public.profiles as profile on profile.id=worker.auth_profile_id
  where notification.id=p_notification_id and notification.recipient_profile_id=v_actor_id
    and notification.notification_type in ('wake_reminder','departure_reminder','arrival_reminder')
    and notification.source_incident_event_id is null and notification.source_announcement_id is null
    and notification.source_pre_confirmation_reminder_id is null
    and occurrence.notification_id=notification.id and occurrence.recipient_profile_id=v_actor_id
    and profile.id=v_actor_id and profile.is_active=true and profile.account_type='worker'
    and worker.status='active' and private.worker_owns_assignment(assignment.id)
  limit 1;
  return jsonb_build_object('ok',true,'source_available',v_assignment_id is not null,'assignment_id',v_assignment_id);
end;
$$;

comment on function private.evaluate_worker_reminders(timestamptz,integer) is
  'Trusted bounded OCV1-07A evaluator. Projects immutable in-app reminders from canonical Worker state.';
comment on function public.resolve_worker_journey_reminder_source_context(uuid) is
  'Safely resolves an own journey reminder Notification to the currently owned Assignment.';

alter function private.worker_journey_timing_policy() owner to postgres;
alter function private.evaluate_worker_reminders(timestamptz,integer) owner to postgres;
alter function public.resolve_pre_confirmation_reminder_source_context(uuid) owner to postgres;
alter function public.resolve_worker_journey_reminder_source_context(uuid) owner to postgres;

revoke all on function private.worker_journey_timing_policy() from public,anon,authenticated,service_role;
revoke all on function private.evaluate_worker_reminders(timestamptz,integer) from public,anon,authenticated,service_role;
revoke all on function public.resolve_worker_journey_reminder_source_context(uuid) from public,anon,authenticated,service_role;
grant execute on function public.resolve_worker_journey_reminder_source_context(uuid) to authenticated;
