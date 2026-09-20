-- NOTIF-2B: narrow pre-confirmation reminder command, projection, and safe resolver.

create table private.pre_confirmation_reminder_commands (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null,
  idempotency_key uuid not null,
  mode text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint pre_confirmation_reminder_commands_actor_fkey
    foreign key (actor_profile_id) references public.profiles(id) on delete restrict,
  constraint pre_confirmation_reminder_commands_actor_key
    unique (actor_profile_id, idempotency_key),
  constraint pre_confirmation_reminder_commands_mode_check
    check (mode in ('single', 'bulk')),
  constraint pre_confirmation_reminder_commands_fingerprint_not_blank
    check (btrim(request_fingerprint) <> '')
);

create table private.pre_confirmation_reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null,
  assignment_id uuid not null,
  recipient_profile_id uuid,
  outcome text not null,
  notification_id uuid,
  requested_at timestamptz not null default clock_timestamp(),
  constraint pre_confirmation_reminder_occurrences_command_fkey
    foreign key (command_id)
    references private.pre_confirmation_reminder_commands(id)
    on delete restrict,
  constraint pre_confirmation_reminder_occurrences_recipient_fkey
    foreign key (recipient_profile_id) references public.profiles(id) on delete restrict,
  constraint pre_confirmation_reminder_occurrences_command_assignment_key
    unique (command_id, assignment_id),
  constraint pre_confirmation_reminder_occurrences_notification_key
    unique (notification_id),
  constraint pre_confirmation_reminder_occurrences_outcome_check
    check (
      outcome in (
        'projected',
        'not_eligible',
        'no_recipient',
        'inactive_recipient',
        'rate_limited',
        'unavailable'
      )
    ),
  constraint pre_confirmation_reminder_occurrences_shape_check
    check (
      (
        outcome = 'projected'
        and recipient_profile_id is not null
        and notification_id is not null
      )
      or (
        outcome <> 'projected'
        and notification_id is null
      )
    )
);

alter table private.pre_confirmation_reminder_commands enable row level security;
alter table private.pre_confirmation_reminder_occurrences enable row level security;

revoke all privileges on table private.pre_confirmation_reminder_commands
  from public, anon, authenticated, service_role;
revoke all privileges on table private.pre_confirmation_reminder_occurrences
  from public, anon, authenticated, service_role;

alter table public.in_app_notifications
  add column source_pre_confirmation_reminder_id uuid,
  add constraint in_app_notifications_source_pre_confirmation_reminder_fkey
    foreign key (source_pre_confirmation_reminder_id)
    references private.pre_confirmation_reminder_occurrences(id)
    on delete restrict;

alter table public.in_app_notifications
  drop constraint in_app_notifications_type_check,
  drop constraint in_app_notifications_source_shape_check,
  add constraint in_app_notifications_type_check
    check (
      notification_type in (
        'incident_acknowledged',
        'incident_resolved',
        'announcement_published',
        'pre_confirmation_reminder'
      )
    ),
  add constraint in_app_notifications_source_shape_check check (
    (
      notification_type in ('incident_acknowledged', 'incident_resolved')
      and source_incident_event_id is not null
      and source_announcement_id is null
      and source_pre_confirmation_reminder_id is null
    )
    or (
      notification_type = 'announcement_published'
      and source_incident_event_id is null
      and source_announcement_id is not null
      and source_pre_confirmation_reminder_id is null
    )
    or (
      notification_type = 'pre_confirmation_reminder'
      and source_incident_event_id is null
      and source_announcement_id is null
      and source_pre_confirmation_reminder_id is not null
    )
  );

create unique index in_app_notifications_pre_confirmation_reminder_recipient_key
  on public.in_app_notifications(source_pre_confirmation_reminder_id, recipient_profile_id)
  where source_pre_confirmation_reminder_id is not null;

alter table private.pre_confirmation_reminder_occurrences
  add constraint pre_confirmation_reminder_occurrences_notification_fkey
    foreign key (notification_id)
    references public.in_app_notifications(id)
    on delete restrict
    deferrable initially deferred;

create index pre_confirmation_reminder_occurrences_assignment_projected_idx
  on private.pre_confirmation_reminder_occurrences(assignment_id, requested_at desc)
  where outcome = 'projected';

create function private.pre_confirmation_reminder_command_result(
  p_command_id uuid,
  p_replayed boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with item_rows as (
    select
      o.assignment_id,
      o.outcome,
      o.notification_id
    from private.pre_confirmation_reminder_occurrences as o
    where o.command_id = p_command_id
    order by o.assignment_id
  ),
  aggregate_rows as (
    select
      count(*)::integer as requested,
      count(*) filter (where outcome = 'projected')::integer as projected,
      count(*) filter (where outcome <> 'projected')::integer as skipped,
      count(distinct outcome)::integer as outcome_kinds,
      bool_and(outcome in ('no_recipient', 'inactive_recipient')) as only_no_recipient,
      jsonb_agg(
        jsonb_build_object(
          'assignment_id', assignment_id,
          'outcome', outcome,
          'notification_id', notification_id
        )
        order by assignment_id
      ) as items
    from item_rows
  )
  select jsonb_build_object(
    'ok', true,
    'command_id', p_command_id,
    'replayed', p_replayed,
    'status', case
      when a.projected = a.requested then 'complete'
      when a.projected = 0 and a.only_no_recipient then 'no_recipient'
      when a.projected = 0 and a.outcome_kinds = 1 then 'no_action'
      else 'partial'
    end,
    'counts', jsonb_build_object(
      'requested', a.requested,
      'projected', a.projected,
      'skipped', a.skipped
    ),
    'items', coalesce(a.items, '[]'::jsonb)
  )
  from aggregate_rows as a;
$$;

create function private.send_pre_confirmation_reminders_core(
  p_mode text,
  p_assignment_ids uuid[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_type text;
  v_assignment_ids uuid[];
  v_assignment_id uuid;
  v_command_id uuid;
  v_fingerprint text;
  v_existing record;
  v_assignment record;
  v_occurrence_id uuid;
  v_notification_id uuid;
  v_outcome text;
  v_recipient_profile_id uuid;
  v_now timestamptz := clock_timestamp();
  v_inserted boolean;
begin
  if v_actor_id is null
    or p_idempotency_key is null
    or p_mode not in ('single', 'bulk')
    or p_assignment_ids is null
    or coalesce(cardinality(p_assignment_ids), 0) = 0
    or array_position(p_assignment_ids, null) is not null
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select array_agg(distinct target_id order by target_id)
  into v_assignment_ids
  from unnest(p_assignment_ids) as target(target_id);

  if coalesce(cardinality(v_assignment_ids), 0) = 0
    or cardinality(v_assignment_ids) > 50
    or (p_mode = 'single' and cardinality(v_assignment_ids) <> 1)
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select p.account_type
  into v_actor_type
  from public.profiles as p
  where p.id = v_actor_id
    and p.is_active
    and p.account_type in ('manager', 'system_admin');

  if not found then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_fingerprint := p_mode || ':' || array_to_string(v_assignment_ids, ',');
  v_command_id := gen_random_uuid();

  insert into private.pre_confirmation_reminder_commands (
    id,
    actor_profile_id,
    idempotency_key,
    mode,
    request_fingerprint,
    created_at
  ) values (
    v_command_id,
    v_actor_id,
    p_idempotency_key,
    p_mode,
    v_fingerprint,
    v_now
  )
  on conflict (actor_profile_id, idempotency_key) do nothing;
  v_inserted := found;

  if not v_inserted then
    select c.id, c.mode, c.request_fingerprint, c.completed_at
    into v_existing
    from private.pre_confirmation_reminder_commands as c
    where c.actor_profile_id = v_actor_id
      and c.idempotency_key = p_idempotency_key
    for update;

    if v_existing.mode <> p_mode or v_existing.request_fingerprint <> v_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;

    if v_existing.completed_at is null then
      raise exception 'stored reminder command is incomplete';
    end if;

    return private.pre_confirmation_reminder_command_result(v_existing.id, true);
  end if;

  foreach v_assignment_id in array v_assignment_ids loop
    v_outcome := 'unavailable';
    v_recipient_profile_id := null;
    v_notification_id := null;

    select
      a.id,
      a.status as assignment_status,
      a.worker_id,
      ss.starts_at,
      ss.status as shift_status,
      w.auth_profile_id,
      w.status as worker_status,
      p.id as recipient_profile_id,
      p.account_type as recipient_account_type,
      p.is_active as recipient_is_active
    into v_assignment
    from public.assignments as a
    join public.shift_slots as ss on ss.id = a.shift_slot_id
    join public.workers as w on w.id = a.worker_id
    left join public.profiles as p on p.id = w.auth_profile_id
    where a.id = v_assignment_id
      and (
        v_actor_type = 'system_admin'
        or (
          v_actor_type = 'manager'
          and private.has_assignment_branch_access(a.id)
        )
      )
    for update of a;

    if found then
      if v_assignment.assignment_status not in ('assigned', 'confirmed', 'completed')
        or v_assignment.shift_status = 'cancelled'
        or v_now < (
          date_trunc('day', v_assignment.starts_at at time zone 'Asia/Tokyo')
          at time zone 'Asia/Tokyo'
        ) - interval '1 day'
        or v_now >= v_assignment.starts_at
        or exists (
          select 1
          from public.pre_shift_confirmations as c
          where c.assignment_id = v_assignment_id
        )
      then
        v_outcome := 'not_eligible';
      elsif exists (
        select 1
        from private.pre_confirmation_reminder_occurrences as o
        where o.assignment_id = v_assignment_id
          and o.outcome = 'projected'
          and o.requested_at > v_now - interval '15 minutes'
      ) then
        v_outcome := 'rate_limited';
      elsif v_assignment.auth_profile_id is null
        or v_assignment.recipient_profile_id is null
      then
        v_outcome := 'no_recipient';
      elsif v_assignment.worker_status <> 'active'
        or not v_assignment.recipient_is_active
        or v_assignment.recipient_account_type <> 'worker'
      then
        v_outcome := 'inactive_recipient';
        v_recipient_profile_id := v_assignment.recipient_profile_id;
      else
        v_outcome := 'projected';
        v_recipient_profile_id := v_assignment.recipient_profile_id;
        v_notification_id := gen_random_uuid();
      end if;
    end if;

    v_occurrence_id := gen_random_uuid();

    insert into private.pre_confirmation_reminder_occurrences (
      id,
      command_id,
      assignment_id,
      recipient_profile_id,
      outcome,
      notification_id,
      requested_at
    ) values (
      v_occurrence_id,
      v_command_id,
      v_assignment_id,
      v_recipient_profile_id,
      v_outcome,
      v_notification_id,
      v_now
    );

    if v_outcome = 'projected' then
      insert into public.in_app_notifications (
        id,
        recipient_profile_id,
        notification_type,
        source_incident_event_id,
        source_announcement_id,
        source_pre_confirmation_reminder_id,
        title,
        summary,
        created_at
      ) values (
        v_notification_id,
        v_recipient_profile_id,
        'pre_confirmation_reminder',
        null,
        null,
        v_occurrence_id,
        '勤務前確認の回答をお願いします',
        '勤務前確認が未回答です。勤務詳細から回答してください。',
        v_now
      );
    end if;
  end loop;

  update private.pre_confirmation_reminder_commands as c
  set completed_at = clock_timestamp()
  where c.id = v_command_id;

  return private.pre_confirmation_reminder_command_result(v_command_id, false);
exception
  when others then
    raise;
end;
$$;

create function public.send_pre_confirmation_reminder(
  p_assignment_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.send_pre_confirmation_reminders_core(
    'single',
    array[p_assignment_id],
    p_idempotency_key
  );
$$;

create function public.send_pre_confirmation_reminders(
  p_assignment_ids uuid[],
  p_idempotency_key uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.send_pre_confirmation_reminders_core(
    'bulk',
    p_assignment_ids,
    p_idempotency_key
  );
$$;

create function public.resolve_pre_confirmation_reminder_source_context(
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
  v_assignment_id uuid;
begin
  if p_notification_id is null or v_actor_id is null then
    return jsonb_build_object(
      'ok', true,
      'source_available', false,
      'assignment_id', null
    );
  end if;

  select a.id
  into v_assignment_id
  from public.in_app_notifications as n
  join private.pre_confirmation_reminder_occurrences as o
    on o.id = n.source_pre_confirmation_reminder_id
  join public.assignments as a on a.id = o.assignment_id
  join public.workers as w on w.id = a.worker_id
  join public.profiles as p on p.id = w.auth_profile_id
  where n.id = p_notification_id
    and n.recipient_profile_id = v_actor_id
    and n.notification_type = 'pre_confirmation_reminder'
    and n.source_incident_event_id is null
    and n.source_announcement_id is null
    and o.outcome = 'projected'
    and o.notification_id = n.id
    and o.recipient_profile_id = v_actor_id
    and p.id = v_actor_id
    and p.is_active
    and p.account_type = 'worker'
    and w.status = 'active'
    and private.worker_owns_assignment(a.id)
  limit 1;

  if v_assignment_id is null then
    return jsonb_build_object(
      'ok', true,
      'source_available', false,
      'assignment_id', null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'source_available', true,
    'assignment_id', v_assignment_id
  );
end;
$$;

comment on function public.send_pre_confirmation_reminder(uuid, uuid) is
  'Creates or replays one authorized pre-confirmation reminder command.';
comment on function public.send_pre_confirmation_reminders(uuid[], uuid) is
  'Creates or replays one authorized bounded pre-confirmation reminder bulk command.';
comment on function public.resolve_pre_confirmation_reminder_source_context(uuid) is
  'Resolves an active Worker own reminder Notification to its currently owned Assignment.';

alter function private.pre_confirmation_reminder_command_result(uuid, boolean) owner to postgres;
alter function private.send_pre_confirmation_reminders_core(text, uuid[], uuid) owner to postgres;
alter function public.send_pre_confirmation_reminder(uuid, uuid) owner to postgres;
alter function public.send_pre_confirmation_reminders(uuid[], uuid) owner to postgres;
alter function public.resolve_pre_confirmation_reminder_source_context(uuid) owner to postgres;

revoke all on function private.pre_confirmation_reminder_command_result(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.send_pre_confirmation_reminders_core(text, uuid[], uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.send_pre_confirmation_reminder(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.send_pre_confirmation_reminders(uuid[], uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_pre_confirmation_reminder_source_context(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.send_pre_confirmation_reminder(uuid, uuid) to authenticated;
grant execute on function public.send_pre_confirmation_reminders(uuid[], uuid) to authenticated;
grant execute on function public.resolve_pre_confirmation_reminder_source_context(uuid) to authenticated;
