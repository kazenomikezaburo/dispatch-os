-- OCV1-07C2-06A: single-delivery canary isolation for manual provider verification.

create table private.line_delivery_canary_scopes (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references private.line_notification_deliveries(id) on delete restrict,
  expected_recipient_profile_id uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  revoked_at timestamptz,
  constraint line_delivery_canary_scopes_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '15 minutes'),
  constraint line_delivery_canary_scopes_state_check
    check (claimed_at is null or revoked_at is null)
);

create unique index line_delivery_canary_scopes_open_delivery_key
  on private.line_delivery_canary_scopes(delivery_id)
  where claimed_at is null and revoked_at is null;

create index line_delivery_canary_scopes_expiry_idx
  on private.line_delivery_canary_scopes(expires_at,id)
  where claimed_at is null and revoked_at is null;

alter table private.line_delivery_canary_scopes enable row level security;
revoke all on table private.line_delivery_canary_scopes from public,anon,authenticated,service_role;

do $body$
begin
  if not exists (select 1 from pg_roles where rolname='opscue_line_canary_operator') then
    create role opscue_line_canary_operator
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname='opscue_line_canary_dispatcher') then
    create role opscue_line_canary_dispatcher
      login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end;
$body$;

create function private.create_line_delivery_canary_scope(
  p_notification_id uuid,
  p_expected_recipient_profile_id uuid,
  p_valid_for_minutes integer default 15
)
returns uuid
language plpgsql
security definer
set search_path=''
set statement_timeout='10s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_delivery record;
  v_scope_id uuid;
begin
  if p_notification_id is null or p_expected_recipient_profile_id is null
     or p_valid_for_minutes is null or p_valid_for_minutes not between 1 and 15 then
    raise exception using errcode='22023',message='invalid LINE canary scope request';
  end if;

  select delivery.id,delivery.status,delivery.attempt_count,delivery.lease_token,
         notification.recipient_profile_id,notification.notification_type
  into v_delivery
  from private.line_notification_deliveries as delivery
  join public.in_app_notifications as notification on notification.id=delivery.notification_id
  where delivery.notification_id=p_notification_id
  for update of delivery;

  if not found
     or v_delivery.recipient_profile_id is distinct from p_expected_recipient_profile_id
     or v_delivery.notification_type not in (
       'pre_confirmation_reminder','wake_reminder','departure_reminder','arrival_reminder'
     )
     or v_delivery.status not in ('pending','retryable_failure')
     or v_delivery.attempt_count <> 0
     or v_delivery.lease_token is not null
     or exists (
       select 1 from private.line_delivery_attempt_starts as attempt
       where attempt.delivery_id=v_delivery.id
     ) then
    raise exception using errcode='P0001',message='LINE canary target is unavailable';
  end if;

  update private.line_delivery_canary_scopes as scope
  set revoked_at=v_now
  where scope.delivery_id=v_delivery.id
    and scope.claimed_at is null and scope.revoked_at is null
    and scope.expires_at <= v_now;

  insert into private.line_delivery_canary_scopes(
    delivery_id,expected_recipient_profile_id,expires_at,created_at
  ) values (
    v_delivery.id,p_expected_recipient_profile_id,
    v_now+make_interval(mins=>p_valid_for_minutes),v_now
  ) returning id into v_scope_id;

  return v_scope_id;
end;
$$;

create function private.revoke_line_delivery_canary_scope(p_scope_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
set statement_timeout='10s'
as $$
declare v_updated integer;
begin
  if p_scope_id is null then return false; end if;
  update private.line_delivery_canary_scopes as scope
  set revoked_at=clock_timestamp()
  where scope.id=p_scope_id and scope.claimed_at is null and scope.revoked_at is null;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

create function private.claim_line_delivery_locked(p_delivery_id uuid,p_now timestamptz)
returns table (
  delivery_id uuid,notification_id uuid,lease_token uuid,retry_key uuid,
  attempt_number smallint,line_user_id text,notification_title text,notification_summary text
)
language plpgsql
security definer
set search_path=''
set statement_timeout='15s'
as $$
declare
  v_delivery record; v_context record; v_attempt_start_id uuid;
  v_new_lease_token uuid; v_next_attempt_at timestamptz; v_terminal_reason text;
begin
  select delivery.* into v_delivery
  from private.line_notification_deliveries as delivery
  where delivery.id=p_delivery_id
    and delivery.status in ('pending','retryable_failure')
    and delivery.next_attempt_at <= p_now
    and (delivery.lease_token is null or delivery.lease_expires_at <= p_now)
  for update;
  if not found then return; end if;

  if v_delivery.lease_token is not null then
    select attempt.id into v_attempt_start_id
    from private.line_delivery_attempt_starts as attempt
    where attempt.delivery_id=v_delivery.id and attempt.lease_token=v_delivery.lease_token;
    if v_attempt_start_id is not null then
      insert into private.line_delivery_attempt_results(
        attempt_start_id,outcome,reason,http_status,provider_request_id,completed_at
      ) values (v_attempt_start_id,'unknown_result','unknown_result',null,null,p_now)
      on conflict (attempt_start_id) do nothing;
    end if;
    if v_delivery.attempt_count >= 4 or v_delivery.first_attempt_at is null
       or v_delivery.first_attempt_at+interval '23 hours' <= p_now then
      update private.line_notification_deliveries as delivery
      set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
          finalized_at=p_now,status_reason='retry_exhausted',updated_at=p_now
      where delivery.id=v_delivery.id;
    else
      v_next_attempt_at:=p_now+private.line_delivery_retry_delay(v_delivery.attempt_count);
      if v_next_attempt_at >= v_delivery.first_attempt_at+interval '23 hours' then
        update private.line_notification_deliveries as delivery
        set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
            finalized_at=p_now,status_reason='retry_exhausted',updated_at=p_now
        where delivery.id=v_delivery.id;
      else
        update private.line_notification_deliveries as delivery
        set status='retryable_failure',next_attempt_at=v_next_attempt_at,lease_token=null,
            lease_expires_at=null,status_reason='unknown_result',updated_at=p_now
        where delivery.id=v_delivery.id;
      end if;
    end if;
    return;
  end if;

  select notification.recipient_profile_id,notification.notification_type,
         notification.created_at as notification_created_at,notification.title,notification.summary,
         link.line_user_id,link.destination_status,link.external_reminders_enabled,link.enabled_at,
         private.is_active_worker_profile(notification.recipient_profile_id) as worker_active
  into v_context
  from public.in_app_notifications as notification
  left join private.worker_line_links as link on link.profile_id=notification.recipient_profile_id
  where notification.id=v_delivery.notification_id;

  v_terminal_reason:=case
    when v_context.recipient_profile_id is null then 'invalid_request'
    when not v_context.worker_active then 'worker_inactive'
    when v_context.line_user_id is null then 'destination_unlinked'
    when v_context.destination_status='suspended' then 'worker_inactive'
    when v_context.destination_status<>'linked_available' then 'destination_unavailable'
    when not v_context.external_reminders_enabled or v_context.enabled_at is null
      or v_context.notification_created_at<v_context.enabled_at then 'delivery_disabled'
    when v_context.notification_type not in (
      'pre_confirmation_reminder','wake_reminder','departure_reminder','arrival_reminder'
    ) then 'invalid_request'
    when v_delivery.attempt_count>=4 then 'retry_exhausted'
    when v_delivery.first_attempt_at is not null
      and v_delivery.first_attempt_at+interval '23 hours'<=p_now then 'retry_exhausted'
    else null end;

  if v_terminal_reason is not null then
    update private.line_notification_deliveries as delivery
    set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
        finalized_at=p_now,status_reason=v_terminal_reason,updated_at=p_now
    where delivery.id=v_delivery.id;
    return;
  end if;

  v_new_lease_token:=gen_random_uuid();
  update private.line_notification_deliveries as delivery
  set attempt_count=delivery.attempt_count+1,first_attempt_at=coalesce(delivery.first_attempt_at,p_now),
      lease_token=v_new_lease_token,lease_expires_at=p_now+interval '60 seconds',updated_at=p_now
  where delivery.id=v_delivery.id;
  insert into private.line_delivery_attempt_starts(delivery_id,attempt_number,lease_token,started_at)
  values (v_delivery.id,(v_delivery.attempt_count+1)::smallint,v_new_lease_token,p_now);

  delivery_id:=v_delivery.id; notification_id:=v_delivery.notification_id;
  lease_token:=v_new_lease_token; retry_key:=v_delivery.retry_key;
  attempt_number:=(v_delivery.attempt_count+1)::smallint; line_user_id:=v_context.line_user_id;
  notification_title:=v_context.title; notification_summary:=v_context.summary;
  return next;
end;
$$;

create or replace function private.claim_line_deliveries(p_limit integer default 20)
returns table (
  delivery_id uuid,notification_id uuid,lease_token uuid,retry_key uuid,
  attempt_number smallint,line_user_id text,notification_title text,notification_summary text
)
language plpgsql security definer set search_path='' set statement_timeout='15s'
as $$
declare v_now timestamptz:=clock_timestamp(); v_delivery record;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception using errcode='22023',message='line delivery claim limit must be between 1 and 100';
  end if;
  for v_delivery in
    select delivery.id
    from private.line_notification_deliveries as delivery
    where delivery.status in ('pending','retryable_failure')
      and delivery.next_attempt_at<=v_now
      and (delivery.lease_token is null or delivery.lease_expires_at<=v_now)
    order by delivery.next_attempt_at,delivery.created_at,delivery.id
    limit p_limit for update of delivery skip locked
  loop
    return query select * from private.claim_line_delivery_locked(v_delivery.id,v_now);
  end loop;
end;
$$;

create function private.claim_line_delivery_canary(p_scope_id uuid)
returns table (
  delivery_id uuid,notification_id uuid,lease_token uuid,retry_key uuid,
  attempt_number smallint,line_user_id text,notification_title text,notification_summary text
)
language plpgsql security definer set search_path='' set statement_timeout='15s'
as $$
declare v_now timestamptz:=clock_timestamp(); v_scope record; v_claim record;
begin
  if p_scope_id is null then return; end if;
  select scope.* into v_scope
  from private.line_delivery_canary_scopes as scope
  where scope.id=p_scope_id and scope.claimed_at is null and scope.revoked_at is null
    and scope.expires_at>v_now
  for update skip locked;
  if not found then return; end if;

  if not exists (
    select 1
    from private.line_notification_deliveries as delivery
    join public.in_app_notifications as notification on notification.id=delivery.notification_id
    where delivery.id=v_scope.delivery_id
      and notification.recipient_profile_id=v_scope.expected_recipient_profile_id
      and delivery.status in ('pending','retryable_failure')
      and delivery.attempt_count=0 and delivery.lease_token is null
      and not exists (
        select 1 from private.line_delivery_attempt_starts as attempt
        where attempt.delivery_id=delivery.id
      )
  ) then return; end if;

  select * into v_claim from private.claim_line_delivery_locked(v_scope.delivery_id,v_now);
  if not found then return; end if;
  update private.line_delivery_canary_scopes as scope set claimed_at=v_now where scope.id=v_scope.id;

  delivery_id:=v_claim.delivery_id; notification_id:=v_claim.notification_id;
  lease_token:=v_claim.lease_token; retry_key:=v_claim.retry_key;
  attempt_number:=v_claim.attempt_number; line_user_id:=v_claim.line_user_id;
  notification_title:=v_claim.notification_title; notification_summary:=v_claim.notification_summary;
  return next;
end;
$$;

alter function private.create_line_delivery_canary_scope(uuid,uuid,integer) owner to postgres;
alter function private.revoke_line_delivery_canary_scope(uuid) owner to postgres;
alter function private.claim_line_delivery_locked(uuid,timestamptz) owner to postgres;
alter function private.claim_line_deliveries(integer) owner to postgres;
alter function private.claim_line_delivery_canary(uuid) owner to postgres;

revoke all on schema public from opscue_line_canary_operator,opscue_line_canary_dispatcher;
revoke all on all tables in schema public from opscue_line_canary_operator,opscue_line_canary_dispatcher;
revoke all on all sequences in schema public from opscue_line_canary_operator,opscue_line_canary_dispatcher;
revoke all on all functions in schema public from opscue_line_canary_operator,opscue_line_canary_dispatcher;
revoke all on all tables in schema private from opscue_line_canary_operator,opscue_line_canary_dispatcher;
revoke all on all sequences in schema private from opscue_line_canary_operator,opscue_line_canary_dispatcher;
revoke all on all functions in schema private from opscue_line_canary_operator,opscue_line_canary_dispatcher;
revoke all on function private.claim_line_delivery_locked(uuid,timestamptz) from public,anon,authenticated,service_role,opscue_line_dispatcher,opscue_line_canary_dispatcher,opscue_line_canary_operator;
revoke all on function private.claim_line_deliveries(integer) from public,anon,authenticated,service_role,opscue_line_canary_dispatcher,opscue_line_canary_operator;
revoke all on function private.claim_line_delivery_canary(uuid) from public,anon,authenticated,service_role,opscue_line_dispatcher,opscue_line_canary_operator;
revoke all on function private.create_line_delivery_canary_scope(uuid,uuid,integer) from public,anon,authenticated,service_role,opscue_line_dispatcher,opscue_line_canary_dispatcher;
revoke all on function private.revoke_line_delivery_canary_scope(uuid) from public,anon,authenticated,service_role,opscue_line_dispatcher,opscue_line_canary_dispatcher;

grant usage on schema private to opscue_line_dispatcher,opscue_line_canary_dispatcher,opscue_line_canary_operator;
grant execute on function private.claim_line_deliveries(integer) to opscue_line_dispatcher;
grant execute on function private.claim_line_delivery_canary(uuid) to opscue_line_canary_dispatcher;
grant execute on function private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text) to opscue_line_canary_dispatcher;
grant execute on function private.create_line_delivery_canary_scope(uuid,uuid,integer) to opscue_line_canary_operator;
grant execute on function private.revoke_line_delivery_canary_scope(uuid) to opscue_line_canary_operator;

comment on table private.line_delivery_canary_scopes is
  'Short-lived single-use operator scopes for an exact pristine LINE delivery. Contains no destination or message body.';
comment on role opscue_line_canary_dispatcher is
  'Manual canary-only LOGIN role. May claim one exact scoped delivery and finalize its lease; broad claim and table DML are denied.';
