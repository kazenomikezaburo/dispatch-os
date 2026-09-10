create table public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null,
  notification_type text not null,
  source_incident_event_id uuid not null,
  title text not null,
  summary text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint in_app_notifications_recipient_profile_id_fkey
    foreign key (recipient_profile_id) references public.profiles(id) on delete cascade,
  constraint in_app_notifications_source_incident_event_id_fkey
    foreign key (source_incident_event_id) references public.operational_incident_events(id) on delete restrict,
  constraint in_app_notifications_type_check
    check (notification_type in ('incident_acknowledged', 'incident_resolved')),
  constraint in_app_notifications_title_check
    check (title = btrim(title) and char_length(title) between 1 and 120),
  constraint in_app_notifications_summary_check
    check (summary = btrim(summary) and char_length(summary) between 1 and 240),
  constraint in_app_notifications_read_at_check
    check (read_at is null or read_at >= created_at),
  constraint in_app_notifications_source_recipient_key
    unique (source_incident_event_id, recipient_profile_id)
);

create index in_app_notifications_recipient_history_idx
  on public.in_app_notifications(recipient_profile_id, created_at desc, id desc);

create index in_app_notifications_recipient_unread_idx
  on public.in_app_notifications(recipient_profile_id, created_at desc, id desc)
  where read_at is null;

create table private.incident_notification_projection_receipts (
  source_incident_event_id uuid primary key,
  outcome text not null,
  notification_id uuid,
  recipient_profile_id uuid,
  processed_at timestamptz not null default now(),
  constraint incident_notification_projection_receipts_source_fkey
    foreign key (source_incident_event_id) references public.operational_incident_events(id) on delete restrict,
  constraint incident_notification_projection_receipts_notification_fkey
    foreign key (notification_id) references public.in_app_notifications(id) on delete cascade,
  constraint incident_notification_projection_receipts_recipient_fkey
    foreign key (recipient_profile_id) references public.profiles(id) on delete set null,
  constraint incident_notification_projection_receipts_notification_key unique (notification_id),
  constraint incident_notification_projection_receipts_outcome_check
    check (outcome in ('projected', 'skipped_no_recipient', 'skipped_inactive_recipient')),
  constraint incident_notification_projection_receipts_shape_check check (
    (outcome = 'projected' and notification_id is not null and recipient_profile_id is not null)
    or (outcome = 'skipped_no_recipient' and notification_id is null and recipient_profile_id is null)
    or (outcome = 'skipped_inactive_recipient' and notification_id is null and recipient_profile_id is not null)
  )
);

create table private.incident_notification_projection_state (
  singleton boolean primary key default true,
  activation_created_at timestamptz not null,
  activation_event_id uuid not null,
  constraint incident_notification_projection_state_singleton_check check (singleton)
);

insert into private.incident_notification_projection_state
  (singleton, activation_created_at, activation_event_id)
values (true, clock_timestamp(), '00000000-0000-0000-0000-000000000000');

alter table public.in_app_notifications enable row level security;
alter table private.incident_notification_projection_receipts enable row level security;
alter table private.incident_notification_projection_state enable row level security;

create policy "Workers can view own in-app notifications"
on public.in_app_notifications for select to authenticated
using (
  recipient_profile_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles as p
    join public.workers as w on w.auth_profile_id = p.id
    where p.id = (select auth.uid())
      and p.is_active
      and p.account_type = 'worker'
      and w.status = 'active'
  )
);

revoke all privileges on table public.in_app_notifications from anon;
revoke all privileges on table public.in_app_notifications from authenticated;
grant select on table public.in_app_notifications to authenticated;

revoke all privileges on table private.incident_notification_projection_receipts from public;
revoke all privileges on table private.incident_notification_projection_receipts from anon;
revoke all privileges on table private.incident_notification_projection_receipts from authenticated;
revoke all privileges on table private.incident_notification_projection_state from public;
revoke all privileges on table private.incident_notification_projection_state from anon;
revoke all privileges on table private.incident_notification_projection_state from authenticated;

create function public.project_incident_in_app_notification(
  p_source_incident_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_type text;
  v_source record;
  v_receipt record;
  v_notification_id uuid;
  v_notification_type text;
  v_title text;
  v_summary text;
begin
  if p_source_incident_event_id is null or v_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select p.account_type into v_actor_type
  from public.profiles as p
  where p.id = v_actor_id
    and p.is_active
    and p.account_type in ('manager', 'system_admin');

  if v_actor_type is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select
    e.id as source_event_id,
    e.event_type,
    i.assignment_id,
    w.auth_profile_id as recipient_profile_id,
    w.status as worker_status,
    rp.is_active as recipient_is_active,
    rp.account_type as recipient_account_type
  into v_source
  from public.operational_incident_events as e
  join public.operational_incidents as i on i.id = e.incident_id
  join public.assignments as a on a.id = i.assignment_id
  join public.workers as w on w.id = a.worker_id
  left join public.profiles as rp on rp.id = w.auth_profile_id
  where e.id = p_source_incident_event_id
    and (
      v_actor_type = 'system_admin'
      or (
        v_actor_type = 'manager'
        and private.has_assignment_branch_access(i.assignment_id)
      )
    )
  for update of e;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select r.* into v_receipt
  from private.incident_notification_projection_receipts as r
  where r.source_incident_event_id = p_source_incident_event_id;

  if found then
    if v_receipt.outcome = 'projected' and not exists (
      select 1 from public.in_app_notifications as n
      where n.id = v_receipt.notification_id
        and n.source_incident_event_id = p_source_incident_event_id
        and n.recipient_profile_id = v_receipt.recipient_profile_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'PROJECTION_CONFLICT');
    end if;
    return jsonb_build_object(
      'ok', true,
      'outcome', v_receipt.outcome,
      'source_event_id', p_source_incident_event_id,
      'notification_id', v_receipt.notification_id,
      'replayed', true
    );
  end if;

  if v_source.event_type not in ('acknowledged', 'resolved') then
    return jsonb_build_object('ok', false, 'code', 'NOT_APPLICABLE');
  end if;

  if v_source.recipient_profile_id is null then
    insert into private.incident_notification_projection_receipts
      (source_incident_event_id, outcome)
    values (p_source_incident_event_id, 'skipped_no_recipient');
    return jsonb_build_object(
      'ok', true,
      'outcome', 'skipped_no_recipient',
      'source_event_id', p_source_incident_event_id,
      'notification_id', null,
      'replayed', false
    );
  end if;

  if v_source.worker_status <> 'active'
     or v_source.recipient_is_active is distinct from true
     or v_source.recipient_account_type is distinct from 'worker' then
    insert into private.incident_notification_projection_receipts
      (source_incident_event_id, outcome, recipient_profile_id)
    values (p_source_incident_event_id, 'skipped_inactive_recipient', v_source.recipient_profile_id);
    return jsonb_build_object(
      'ok', true,
      'outcome', 'skipped_inactive_recipient',
      'source_event_id', p_source_incident_event_id,
      'notification_id', null,
      'replayed', false
    );
  end if;

  if v_source.event_type = 'acknowledged' then
    v_notification_type := 'incident_acknowledged';
    v_title := 'Help Requestへの対応が開始されました';
    v_summary := '管理者がHelp Requestを確認し、対応を開始しました。';
  else
    v_notification_type := 'incident_resolved';
    v_title := 'Help Requestが解決されました';
    v_summary := 'Help Requestが解決済みになりました。';
  end if;

  insert into public.in_app_notifications
    (recipient_profile_id, notification_type, source_incident_event_id, title, summary)
  values
    (v_source.recipient_profile_id, v_notification_type, p_source_incident_event_id, v_title, v_summary)
  returning id into v_notification_id;

  insert into private.incident_notification_projection_receipts
    (source_incident_event_id, outcome, notification_id, recipient_profile_id)
  values
    (p_source_incident_event_id, 'projected', v_notification_id, v_source.recipient_profile_id);

  return jsonb_build_object(
    'ok', true,
    'outcome', 'projected',
    'source_event_id', p_source_incident_event_id,
    'notification_id', v_notification_id,
    'replayed', false
  );
exception
  when unique_violation then
    select r.* into v_receipt
    from private.incident_notification_projection_receipts as r
    where r.source_incident_event_id = p_source_incident_event_id;
    if found then
      return jsonb_build_object(
        'ok', true,
        'outcome', v_receipt.outcome,
        'source_event_id', p_source_incident_event_id,
        'notification_id', v_receipt.notification_id,
        'replayed', true
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'PROJECTION_CONFLICT');
end;
$$;

create function public.mark_in_app_notification_read(
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_read_at timestamptz;
  v_was_unread boolean := false;
begin
  if p_notification_id is null or v_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if not exists (
    select 1
    from public.profiles as p
    join public.workers as w on w.auth_profile_id = p.id
    where p.id = v_actor_id
      and p.is_active
      and p.account_type = 'worker'
      and w.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  update public.in_app_notifications as n
  set read_at = pg_catalog.now()
  where n.id = p_notification_id
    and n.recipient_profile_id = v_actor_id
    and n.read_at is null
  returning n.read_at into v_read_at;

  if found then
    v_was_unread := true;
  else
    select n.read_at into v_read_at
    from public.in_app_notifications as n
    where n.id = p_notification_id
      and n.recipient_profile_id = v_actor_id;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'notification_id', p_notification_id,
    'read_at', v_read_at,
    'replayed', not v_was_unread
  );
end;
$$;

create function private.list_unprojected_incident_notification_events(
  p_after_created_at timestamptz,
  p_after_event_id uuid,
  p_limit integer
)
returns table(source_event_id uuid, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select e.id, e.created_at
  from public.operational_incident_events as e
  cross join private.incident_notification_projection_state as s
  left join private.incident_notification_projection_receipts as r
    on r.source_incident_event_id = e.id
  where s.singleton
    and e.event_type in ('acknowledged', 'resolved')
    and (e.created_at, e.id) > (s.activation_created_at, s.activation_event_id)
    and (
      p_after_created_at is null
      or (e.created_at, e.id) > (p_after_created_at, coalesce(p_after_event_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
    and r.source_incident_event_id is null
  order by e.created_at, e.id
  limit case when p_limit between 1 and 100 then p_limit else 100 end
$$;

alter function public.project_incident_in_app_notification(uuid) owner to postgres;
revoke all on function public.project_incident_in_app_notification(uuid) from public;
revoke all on function public.project_incident_in_app_notification(uuid) from anon;
grant execute on function public.project_incident_in_app_notification(uuid) to authenticated;

alter function public.mark_in_app_notification_read(uuid) owner to postgres;
revoke all on function public.mark_in_app_notification_read(uuid) from public;
revoke all on function public.mark_in_app_notification_read(uuid) from anon;
grant execute on function public.mark_in_app_notification_read(uuid) to authenticated;

alter function private.list_unprojected_incident_notification_events(timestamptz, uuid, integer) owner to postgres;
revoke all on function private.list_unprojected_incident_notification_events(timestamptz, uuid, integer) from public;
revoke all on function private.list_unprojected_incident_notification_events(timestamptz, uuid, integer) from anon;
revoke all on function private.list_unprojected_incident_notification_events(timestamptz, uuid, integer) from authenticated;
revoke all on function private.list_unprojected_incident_notification_events(timestamptz, uuid, integer) from service_role;
