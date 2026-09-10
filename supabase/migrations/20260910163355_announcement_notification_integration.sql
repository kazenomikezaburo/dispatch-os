-- INT-2.9E: Announcement publication notification projection and safe source resolution.

alter table public.in_app_notifications
  alter column source_incident_event_id drop not null,
  add column source_announcement_id uuid,
  add constraint in_app_notifications_source_announcement_id_fkey
    foreign key (source_announcement_id) references public.announcements(id) on delete restrict;

alter table public.in_app_notifications
  drop constraint in_app_notifications_type_check,
  add constraint in_app_notifications_type_check
    check (notification_type in ('incident_acknowledged', 'incident_resolved', 'announcement_published')),
  add constraint in_app_notifications_source_shape_check check (
    (
      notification_type in ('incident_acknowledged', 'incident_resolved')
      and source_incident_event_id is not null
      and source_announcement_id is null
    )
    or (
      notification_type = 'announcement_published'
      and source_incident_event_id is null
      and source_announcement_id is not null
    )
  );

create unique index in_app_notifications_announcement_recipient_key
  on public.in_app_notifications(source_announcement_id, recipient_profile_id)
  where source_announcement_id is not null;

create table private.announcement_notification_projection_receipts (
  announcement_id uuid not null,
  recipient_profile_id uuid not null,
  notification_id uuid not null,
  outcome text not null default 'projected',
  processed_at timestamptz not null default now(),
  primary key (announcement_id, recipient_profile_id),
  constraint announcement_notification_projection_receipts_announcement_fkey
    foreign key (announcement_id) references public.announcements(id) on delete restrict,
  constraint announcement_notification_projection_receipts_recipient_fkey
    foreign key (recipient_profile_id) references public.profiles(id) on delete restrict,
  constraint announcement_notification_projection_receipts_notification_fkey
    foreign key (notification_id) references public.in_app_notifications(id) on delete cascade,
  constraint announcement_notification_projection_receipts_notification_key unique (notification_id),
  constraint announcement_notification_projection_receipts_outcome_check check (outcome = 'projected')
);

create table private.announcement_notification_projection_state (
  singleton boolean primary key default true,
  activation_published_at timestamptz not null,
  activation_announcement_id uuid not null,
  activation_recipient_profile_id uuid not null,
  constraint announcement_notification_projection_state_singleton_check check (singleton)
);

insert into private.announcement_notification_projection_state
  (singleton, activation_published_at, activation_announcement_id, activation_recipient_profile_id)
values (
  true,
  clock_timestamp(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

alter table private.announcement_notification_projection_receipts enable row level security;
alter table private.announcement_notification_projection_state enable row level security;

revoke all privileges on table private.announcement_notification_projection_receipts
  from public, anon, authenticated, service_role;
revoke all privileges on table private.announcement_notification_projection_state
  from public, anon, authenticated, service_role;

create function public.project_announcement_in_app_notifications(
  p_announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_announcement record;
  v_recipient record;
  v_notification_id uuid;
  v_recipient_count integer := 0;
  v_created_count integer := 0;
  v_receipt_count integer := 0;
  v_summary text;
begin
  if p_announcement_id is null or v_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select a.id, a.state, a.scope_type, a.branch_id, a.title, a.body
  into v_announcement
  from public.announcements as a
  where a.id = p_announcement_id
  for update;

  if not found
     or not private.can_admin_announcement_scope(v_announcement.scope_type, v_announcement.branch_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_announcement.state <> 'published' then
    return jsonb_build_object('ok', false, 'code', 'NOT_APPLICABLE');
  end if;

  v_summary := left(btrim(regexp_replace(v_announcement.body, '[[:space:]]+', ' ', 'g')), 240);

  for v_recipient in
    select ar.recipient_profile_id
    from public.announcement_recipients as ar
    where ar.announcement_id = p_announcement_id
    order by ar.recipient_profile_id
  loop
    v_recipient_count := v_recipient_count + 1;

    insert into public.in_app_notifications (
      recipient_profile_id,
      notification_type,
      source_incident_event_id,
      source_announcement_id,
      title,
      summary
    ) values (
      v_recipient.recipient_profile_id,
      'announcement_published',
      null,
      p_announcement_id,
      v_announcement.title,
      v_summary
    )
    on conflict (source_announcement_id, recipient_profile_id)
      where source_announcement_id is not null
    do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      v_created_count := v_created_count + 1;
    else
      select n.id into v_notification_id
      from public.in_app_notifications as n
      where n.source_announcement_id = p_announcement_id
        and n.recipient_profile_id = v_recipient.recipient_profile_id
        and n.notification_type = 'announcement_published';
    end if;

    insert into private.announcement_notification_projection_receipts (
      announcement_id,
      recipient_profile_id,
      notification_id,
      outcome
    ) values (
      p_announcement_id,
      v_recipient.recipient_profile_id,
      v_notification_id,
      'projected'
    )
    on conflict (announcement_id, recipient_profile_id) do nothing;

    if found then
      v_receipt_count := v_receipt_count + 1;
    end if;

    v_notification_id := null;
  end loop;

  if v_recipient_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'PROJECTION_CONFLICT');
  end if;

  return jsonb_build_object(
    'ok', true,
    'announcement_id', p_announcement_id,
    'recipient_count', v_recipient_count,
    'created_count', v_created_count,
    'receipt_count', v_receipt_count,
    'replayed', v_created_count = 0
  );
end;
$$;

create function private.list_unprojected_announcement_notification_recipients(
  p_after_published_at timestamptz,
  p_after_announcement_id uuid,
  p_after_recipient_profile_id uuid,
  p_limit integer
)
returns table(announcement_id uuid, recipient_profile_id uuid, published_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, ar.recipient_profile_id, a.published_at
  from public.announcements as a
  join public.announcement_recipients as ar on ar.announcement_id = a.id
  cross join private.announcement_notification_projection_state as s
  left join public.in_app_notifications as n
    on n.source_announcement_id = a.id
    and n.recipient_profile_id = ar.recipient_profile_id
    and n.notification_type = 'announcement_published'
  left join private.announcement_notification_projection_receipts as r
    on r.announcement_id = a.id
    and r.recipient_profile_id = ar.recipient_profile_id
  where s.singleton
    and a.state = 'published'
    and (a.published_at, a.id, ar.recipient_profile_id) >
      (s.activation_published_at, s.activation_announcement_id, s.activation_recipient_profile_id)
    and (
      p_after_published_at is null
      or (a.published_at, a.id, ar.recipient_profile_id) > (
        p_after_published_at,
        coalesce(p_after_announcement_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(p_after_recipient_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    )
    and (n.id is null or r.notification_id is null or r.notification_id <> n.id)
  order by a.published_at, a.id, ar.recipient_profile_id
  limit case when p_limit between 1 and 100 then p_limit else 100 end;
$$;

create function public.resolve_announcement_notification_source_context(
  p_notification_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_announcement_id uuid;
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

  select a.id into v_announcement_id
  from public.in_app_notifications as n
  join public.announcements as a on a.id = n.source_announcement_id
  join public.announcement_recipients as ar
    on ar.announcement_id = a.id
    and ar.recipient_profile_id = n.recipient_profile_id
  join public.workers as w
    on w.id = ar.worker_id
    and w.auth_profile_id = ar.recipient_profile_id
    and w.status = 'active'
  join public.profiles as p
    on p.id = ar.recipient_profile_id
    and p.account_type = 'worker'
    and p.is_active
  where n.id = p_notification_id
    and n.recipient_profile_id = v_actor_id
    and n.notification_type = 'announcement_published'
    and n.source_incident_event_id is null
    and a.state = 'published'
    and ar.recipient_profile_id = v_actor_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'source_available', v_announcement_id is not null,
    'announcement_id', v_announcement_id
  );
end;
$$;

comment on function public.project_announcement_in_app_notifications(uuid) is
  'Projects one immutable Announcement recipient snapshot into one in-app notification per recipient; retries are idempotent.';
comment on function private.list_unprojected_announcement_notification_recipients(timestamptz, uuid, uuid, integer) is
  'Lists a bounded cursor page of published Announcement recipients missing a notification or matching receipt.';
comment on function public.resolve_announcement_notification_source_context(uuid) is
  'Resolves an active Worker own Announcement notification to a currently published Announcement without exposing internal source metadata.';

alter function public.project_announcement_in_app_notifications(uuid) owner to postgres;
alter function private.list_unprojected_announcement_notification_recipients(timestamptz, uuid, uuid, integer) owner to postgres;
alter function public.resolve_announcement_notification_source_context(uuid) owner to postgres;

revoke all on function public.project_announcement_in_app_notifications(uuid) from public, anon, service_role;
grant execute on function public.project_announcement_in_app_notifications(uuid) to authenticated;

revoke all on function private.list_unprojected_announcement_notification_recipients(timestamptz, uuid, uuid, integer)
  from public, anon, authenticated, service_role;

revoke all on function public.resolve_announcement_notification_source_context(uuid) from public, anon, service_role;
grant execute on function public.resolve_announcement_notification_source_context(uuid) to authenticated;
