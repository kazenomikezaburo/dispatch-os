create table private.worker_line_links (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  line_user_id text not null unique,
  destination_status text not null,
  external_reminders_enabled boolean not null default false,
  enabled_at timestamptz,
  linked_at timestamptz not null default clock_timestamp(),
  availability_event_at timestamptz not null default '-infinity',
  updated_at timestamptz not null default clock_timestamp(),
  constraint worker_line_links_user_id_check
    check (line_user_id ~ '^U[0-9a-f]{32}$'),
  constraint worker_line_links_status_check
    check (destination_status in ('linked_available','linked_unavailable','suspended')),
  constraint worker_line_links_consent_check check (
    (external_reminders_enabled and destination_status = 'linked_available' and enabled_at is not null)
    or (not external_reminders_enabled and enabled_at is null)
  )
);

create table private.worker_line_link_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  state_hash text not null unique,
  nonce_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  constraint worker_line_link_transactions_state_hash_check check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint worker_line_link_transactions_nonce_hash_check check (nonce_hash ~ '^[0-9a-f]{64}$'),
  constraint worker_line_link_transactions_expiry_check check (expires_at > created_at),
  constraint worker_line_link_transactions_terminal_check check (consumed_at is null or cancelled_at is null)
);

create unique index worker_line_link_transactions_one_active_per_worker
  on private.worker_line_link_transactions(profile_id)
  where consumed_at is null and cancelled_at is null;

create table private.line_webhook_receipts (
  webhook_event_id text primary key,
  event_type text not null,
  event_timestamp timestamptz not null,
  outcome text not null,
  processed_at timestamptz not null default clock_timestamp(),
  constraint line_webhook_receipts_event_id_check check (char_length(webhook_event_id) between 1 and 128),
  constraint line_webhook_receipts_event_type_check check (event_type in ('follow','unfollow')),
  constraint line_webhook_receipts_outcome_check check (outcome in ('applied','stale','unmatched'))
);

create table private.worker_notification_continuation_receipts (
  nonce_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid not null references public.in_app_notifications(id) on delete cascade,
  consumed_at timestamptz not null default clock_timestamp(),
  constraint worker_notification_continuation_nonce_hash_check check (nonce_hash ~ '^[0-9a-f]{64}$')
);

alter table private.worker_line_links enable row level security;
alter table private.worker_line_link_transactions enable row level security;
alter table private.line_webhook_receipts enable row level security;
alter table private.worker_notification_continuation_receipts enable row level security;

revoke all on table private.worker_line_links from public, anon, authenticated, service_role;
revoke all on table private.worker_line_link_transactions from public, anon, authenticated, service_role;
revoke all on table private.line_webhook_receipts from public, anon, authenticated, service_role;
revoke all on table private.worker_notification_continuation_receipts from public, anon, authenticated, service_role;

create function private.is_active_worker_profile(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles as p
    join public.workers as w on w.auth_profile_id = p.id
    where p.id = p_profile_id
      and p.account_type = 'worker'
      and p.is_active
      and w.status = 'active'
  )
$$;

create function private.line_internal_secret_valid(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_secret is not null
    and char_length(p_secret) >= 32
    and nullif(current_setting('app.settings.line_internal_secret_sha256', true), '') is not null
    and encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex')
      = current_setting('app.settings.line_internal_secret_sha256', true)
$$;

create function private.suspend_line_link_for_inactive_worker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' and (new.is_active is distinct from true or new.account_type <> 'worker') then
    update private.worker_line_links
    set destination_status = 'suspended', external_reminders_enabled = false,
        enabled_at = null, updated_at = clock_timestamp()
    where profile_id = new.id;
  elsif tg_table_name = 'workers' and new.status <> 'active' and new.auth_profile_id is not null then
    update private.worker_line_links
    set destination_status = 'suspended', external_reminders_enabled = false,
        enabled_at = null, updated_at = clock_timestamp()
    where profile_id = new.auth_profile_id;
  end if;
  return new;
end;
$$;

create function private.remove_line_link_for_deleted_worker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.auth_profile_id is not null then
    delete from private.worker_line_link_transactions where profile_id = old.auth_profile_id;
    delete from private.worker_line_links where profile_id = old.auth_profile_id;
  end if;
  return old;
end;
$$;

create trigger suspend_line_link_on_profile_inactive
after update of is_active, account_type on public.profiles
for each row execute function private.suspend_line_link_for_inactive_worker();

create trigger suspend_line_link_on_worker_inactive
after update of status on public.workers
for each row execute function private.suspend_line_link_for_inactive_worker();

create trigger remove_line_link_on_worker_delete
after delete on public.workers
for each row execute function private.remove_line_link_for_deleted_worker();

create function public.get_own_line_link_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_link record;
begin
  if v_actor is null or not private.is_active_worker_profile(v_actor) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select l.destination_status, l.external_reminders_enabled, l.enabled_at, l.linked_at
  into v_link
  from private.worker_line_links as l
  where l.profile_id = v_actor;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'linked', false,
      'status', 'unlinked',
      'external_reminders_enabled', false,
      'enabled_at', null,
      'linked_at', null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'linked', true,
    'status', v_link.destination_status,
    'external_reminders_enabled', v_link.external_reminders_enabled,
    'enabled_at', v_link.enabled_at,
    'linked_at', v_link.linked_at
  );
end;
$$;

create function public.begin_own_line_link(
  p_state_hash text,
  p_nonce_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_transaction_id uuid;
begin
  if v_actor is null or not private.is_active_worker_profile(v_actor) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if p_state_hash !~ '^[0-9a-f]{64}$' or p_nonce_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 7011));
  update private.worker_line_link_transactions
  set cancelled_at = v_now
  where profile_id = v_actor and consumed_at is null and cancelled_at is null;

  insert into private.worker_line_link_transactions(profile_id, state_hash, nonce_hash, expires_at)
  values (v_actor, p_state_hash, p_nonce_hash, v_now + interval '10 minutes')
  returning id into v_transaction_id;

  return jsonb_build_object('ok', true, 'transaction_id', v_transaction_id, 'expires_at', v_now + interval '10 minutes');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'TRANSACTION_CONFLICT');
end;
$$;

create function public.complete_own_line_link(
  p_state_hash text,
  p_nonce_hash text,
  p_line_user_id text,
  p_friend_available boolean,
  p_internal_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_transaction record;
  v_status text;
begin
  if not private.line_internal_secret_valid(p_internal_secret) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_actor is null or not private.is_active_worker_profile(v_actor) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if p_state_hash !~ '^[0-9a-f]{64}$'
     or p_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_line_user_id !~ '^U[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select t.* into v_transaction
  from private.worker_line_link_transactions as t
  where t.profile_id = v_actor and t.state_hash = p_state_hash
  for update;

  if not found
     or v_transaction.nonce_hash <> p_nonce_hash
     or v_transaction.consumed_at is not null
     or v_transaction.cancelled_at is not null
     or v_transaction.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'LINK_TRANSACTION_INVALID');
  end if;

  update private.worker_line_link_transactions
  set consumed_at = v_now
  where id = v_transaction.id;

  v_status := case when p_friend_available then 'linked_available' else 'linked_unavailable' end;
  insert into private.worker_line_links(
    profile_id, line_user_id, destination_status, external_reminders_enabled,
    enabled_at, linked_at, availability_event_at, updated_at
  ) values (
    v_actor, p_line_user_id, v_status, false,
    null, v_now, v_now, v_now
  )
  on conflict (profile_id) do update set
    line_user_id = excluded.line_user_id,
    destination_status = excluded.destination_status,
    external_reminders_enabled = false,
    enabled_at = null,
    linked_at = excluded.linked_at,
    availability_event_at = excluded.availability_event_at,
    updated_at = excluded.updated_at;

  return jsonb_build_object('ok', true, 'status', v_status, 'external_reminders_enabled', false);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'LINK_CONFLICT');
end;
$$;

create function public.set_own_line_reminders_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_link record;
begin
  if v_actor is null or not private.is_active_worker_profile(v_actor) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select l.destination_status, l.external_reminders_enabled, l.enabled_at
  into v_link
  from private.worker_line_links as l
  where l.profile_id = v_actor
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_LINKED'); end if;
  if p_enabled and v_link.destination_status <> 'linked_available' then
    return jsonb_build_object('ok', false, 'code', 'DESTINATION_UNAVAILABLE');
  end if;

  update private.worker_line_links
  set external_reminders_enabled = p_enabled,
      enabled_at = case when p_enabled then coalesce(v_link.enabled_at, v_now) else null end,
      updated_at = v_now
  where profile_id = v_actor;

  return jsonb_build_object(
    'ok', true,
    'external_reminders_enabled', p_enabled,
    'enabled_at', case when p_enabled then coalesce(v_link.enabled_at, v_now) else null end,
    'replayed', v_link.external_reminders_enabled = p_enabled
  );
end;
$$;

create function public.unlink_own_line_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_deleted boolean := false;
begin
  if v_actor is null or not private.is_active_worker_profile(v_actor) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  delete from private.worker_line_links where profile_id = v_actor;
  v_deleted := found;
  update private.worker_line_link_transactions
  set cancelled_at = clock_timestamp()
  where profile_id = v_actor and consumed_at is null and cancelled_at is null;
  return jsonb_build_object('ok', true, 'unlinked', true, 'replayed', not v_deleted);
end;
$$;

create function public.apply_line_friendship_webhook(
  p_webhook_event_id text,
  p_event_type text,
  p_line_user_id text,
  p_event_timestamp timestamptz,
  p_internal_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_outcome text;
begin
  if not private.line_internal_secret_valid(p_internal_secret) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if p_webhook_event_id is null or char_length(p_webhook_event_id) not between 1 and 128
     or p_event_type not in ('follow','unfollow')
     or p_line_user_id !~ '^U[0-9a-f]{32}$'
     or p_event_timestamp is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if exists (select 1 from private.line_webhook_receipts where webhook_event_id = p_webhook_event_id) then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;

  select l.profile_id, l.availability_event_at into v_link
  from private.worker_line_links as l
  where l.line_user_id = p_line_user_id
  for update;

  if not found then
    v_outcome := 'unmatched';
  elsif p_event_timestamp <= v_link.availability_event_at then
    v_outcome := 'stale';
  else
    update private.worker_line_links
    set destination_status = case when p_event_type = 'follow' then 'linked_available' else 'linked_unavailable' end,
        external_reminders_enabled = case when p_event_type = 'unfollow' then false else external_reminders_enabled end,
        enabled_at = case when p_event_type = 'unfollow' then null else enabled_at end,
        availability_event_at = p_event_timestamp,
        updated_at = clock_timestamp()
    where profile_id = v_link.profile_id;
    v_outcome := 'applied';
  end if;

  insert into private.line_webhook_receipts(webhook_event_id, event_type, event_timestamp, outcome)
  values (p_webhook_event_id, p_event_type, p_event_timestamp, v_outcome);
  return jsonb_build_object('ok', true, 'replayed', false, 'outcome', v_outcome);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'replayed', true);
end;
$$;

create function public.consume_own_notification_continuation(
  p_notification_id uuid,
  p_nonce_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or not private.is_active_worker_profile(v_actor) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if p_notification_id is null or p_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at <= v_now or p_expires_at > v_now + interval '10 minutes' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CONTINUATION');
  end if;
  if not exists (
    select 1 from public.in_app_notifications as n
    where n.id = p_notification_id and n.recipient_profile_id = v_actor
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  insert into private.worker_notification_continuation_receipts(nonce_hash, profile_id, notification_id)
  values (p_nonce_hash, v_actor, p_notification_id);
  return jsonb_build_object('ok', true, 'notification_id', p_notification_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'CONTINUATION_REPLAY');
end;
$$;

alter function private.is_active_worker_profile(uuid) owner to postgres;
alter function private.line_internal_secret_valid(text) owner to postgres;
alter function private.suspend_line_link_for_inactive_worker() owner to postgres;
alter function private.remove_line_link_for_deleted_worker() owner to postgres;
alter function public.get_own_line_link_status() owner to postgres;
alter function public.begin_own_line_link(text,text) owner to postgres;
alter function public.complete_own_line_link(text,text,text,boolean,text) owner to postgres;
alter function public.set_own_line_reminders_enabled(boolean) owner to postgres;
alter function public.unlink_own_line_account() owner to postgres;
alter function public.apply_line_friendship_webhook(text,text,text,timestamptz,text) owner to postgres;
alter function public.consume_own_notification_continuation(uuid,text,timestamptz) owner to postgres;

revoke all on function private.is_active_worker_profile(uuid) from public, anon, authenticated, service_role;
revoke all on function private.line_internal_secret_valid(text) from public, anon, authenticated, service_role;
revoke all on function private.suspend_line_link_for_inactive_worker() from public, anon, authenticated, service_role;
revoke all on function private.remove_line_link_for_deleted_worker() from public, anon, authenticated, service_role;
revoke all on function public.get_own_line_link_status() from public, anon, authenticated, service_role;
revoke all on function public.begin_own_line_link(text,text) from public, anon, authenticated, service_role;
revoke all on function public.complete_own_line_link(text,text,text,boolean,text) from public, anon, authenticated, service_role;
revoke all on function public.set_own_line_reminders_enabled(boolean) from public, anon, authenticated, service_role;
revoke all on function public.unlink_own_line_account() from public, anon, authenticated, service_role;
revoke all on function public.apply_line_friendship_webhook(text,text,text,timestamptz,text) from public, anon, authenticated, service_role;
revoke all on function public.consume_own_notification_continuation(uuid,text,timestamptz) from public, anon, authenticated, service_role;

grant execute on function public.get_own_line_link_status() to authenticated;
grant execute on function public.begin_own_line_link(text,text) to authenticated;
grant execute on function public.complete_own_line_link(text,text,text,boolean,text) to authenticated;
grant execute on function public.set_own_line_reminders_enabled(boolean) to authenticated;
grant execute on function public.unlink_own_line_account() to authenticated;
grant execute on function public.apply_line_friendship_webhook(text,text,text,timestamptz,text) to anon, authenticated;
grant execute on function public.consume_own_notification_continuation(uuid,text,timestamptz) to authenticated;

comment on table private.worker_line_links is
  'OCV1-07C1 private live LINE destination and explicit reminder consent. Raw LINE user IDs never leave this boundary.';
comment on function public.complete_own_line_link(text,text,text,boolean,text) is
  'Trusted LINE callback command. Requires active Worker session plus server-only internal secret; never callable successfully by a browser alone.';
comment on function public.apply_line_friendship_webhook(text,text,text,timestamptz,text) is
  'Trusted follow/unfollow mutation after raw-body LINE signature verification. Internal secret fails closed.';
