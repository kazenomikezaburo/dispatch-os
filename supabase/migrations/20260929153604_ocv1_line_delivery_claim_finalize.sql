-- OCV1-07C2-03: trusted bounded claim, lease recovery, and finalize commands.

alter table private.line_notification_deliveries
  drop constraint line_notification_deliveries_state_shape_check,
  add constraint line_notification_deliveries_state_shape_check
  check (
    (status = 'pending' and next_attempt_at is not null and finalized_at is null and status_reason is null)
    or (
      status = 'retryable_failure' and next_attempt_at is not null and finalized_at is null
      and status_reason in ('network','timeout','rate_limited','provider_unavailable','unknown_result')
    )
    or (
      status = 'delivered' and next_attempt_at is null and lease_token is null
      and finalized_at is not null
      and status_reason in ('provider_accepted','provider_already_accepted')
    )
    or (
      status = 'terminal_failure' and next_attempt_at is null and lease_token is null
      and finalized_at is not null
      and status_reason in (
        'invalid_request','invalid_destination','provider_forbidden','provider_auth',
        'retry_exhausted','destination_unavailable','delivery_disabled',
        'destination_unlinked','worker_inactive','provider_rejected'
      )
    )
  );

alter table private.line_delivery_attempt_results
  drop constraint line_delivery_attempt_results_outcome_check,
  drop constraint line_delivery_attempt_results_reason_check,
  add constraint line_delivery_attempt_results_outcome_check
    check (outcome in ('delivered','retryable_failure','terminal_failure','unknown_result')),
  add constraint line_delivery_attempt_results_reason_check
    check (reason in (
      'provider_accepted','provider_already_accepted','network','timeout','rate_limited',
      'provider_unavailable','unknown_result','invalid_request','invalid_destination',
      'provider_forbidden','provider_auth','retry_exhausted','provider_rejected'
    ));

create function private.line_delivery_retry_delay(p_attempt_count integer)
returns interval
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_attempt_count
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '15 minutes'
    else null
  end
$$;

create function private.claim_line_deliveries(p_limit integer default 20)
returns table (
  delivery_id uuid,
  notification_id uuid,
  lease_token uuid,
  retry_key uuid,
  attempt_number smallint,
  line_user_id text,
  notification_title text,
  notification_summary text
)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_delivery record;
  v_context record;
  v_attempt_start_id uuid;
  v_new_lease_token uuid;
  v_next_attempt_at timestamptz;
  v_terminal_reason text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'line delivery claim limit must be between 1 and 100';
  end if;

  for v_delivery in
    select delivery.*
    from private.line_notification_deliveries as delivery
    where delivery.status in ('pending','retryable_failure')
      and delivery.next_attempt_at <= v_now
      and (delivery.lease_token is null or delivery.lease_expires_at <= v_now)
    order by delivery.next_attempt_at,delivery.created_at,delivery.id
    limit p_limit
    for update of delivery skip locked
  loop
    if v_delivery.lease_token is not null then
      select attempt.id into v_attempt_start_id
      from private.line_delivery_attempt_starts as attempt
      where attempt.delivery_id = v_delivery.id
        and attempt.lease_token = v_delivery.lease_token;

      if v_attempt_start_id is not null then
        insert into private.line_delivery_attempt_results(
          attempt_start_id,outcome,reason,http_status,provider_request_id,completed_at
        ) values (
          v_attempt_start_id,'unknown_result','unknown_result',null,null,v_now
        ) on conflict (attempt_start_id) do nothing;
      end if;

      if v_delivery.attempt_count >= 4
         or v_delivery.first_attempt_at is null
         or v_delivery.first_attempt_at + interval '23 hours' <= v_now then
        update private.line_notification_deliveries as delivery
        set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
            finalized_at=v_now,status_reason='retry_exhausted',updated_at=v_now
        where delivery.id=v_delivery.id;
      else
        v_next_attempt_at := v_now + private.line_delivery_retry_delay(v_delivery.attempt_count);
        if v_next_attempt_at >= v_delivery.first_attempt_at + interval '23 hours' then
          update private.line_notification_deliveries as delivery
          set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
              finalized_at=v_now,status_reason='retry_exhausted',updated_at=v_now
          where delivery.id=v_delivery.id;
        else
          update private.line_notification_deliveries as delivery
          set status='retryable_failure',next_attempt_at=v_next_attempt_at,
              lease_token=null,lease_expires_at=null,status_reason='unknown_result',updated_at=v_now
          where delivery.id=v_delivery.id;
        end if;
      end if;
      continue;
    end if;

    select
      notification.recipient_profile_id,
      notification.notification_type,
      notification.created_at as notification_created_at,
      notification.title,
      notification.summary,
      link.line_user_id,
      link.destination_status,
      link.external_reminders_enabled,
      link.enabled_at,
      private.is_active_worker_profile(notification.recipient_profile_id) as worker_active
    into v_context
    from public.in_app_notifications as notification
    left join private.worker_line_links as link
      on link.profile_id = notification.recipient_profile_id
    where notification.id = v_delivery.notification_id;

    v_terminal_reason := case
      when v_context.recipient_profile_id is null then 'invalid_request'
      when not v_context.worker_active then 'worker_inactive'
      when v_context.line_user_id is null then 'destination_unlinked'
      when v_context.destination_status = 'suspended' then 'worker_inactive'
      when v_context.destination_status <> 'linked_available' then 'destination_unavailable'
      when not v_context.external_reminders_enabled
        or v_context.enabled_at is null
        or v_context.notification_created_at < v_context.enabled_at then 'delivery_disabled'
      when v_context.notification_type not in (
        'pre_confirmation_reminder','wake_reminder','departure_reminder','arrival_reminder'
      ) then 'invalid_request'
      when v_delivery.attempt_count >= 4 then 'retry_exhausted'
      when v_delivery.first_attempt_at is not null
        and v_delivery.first_attempt_at + interval '23 hours' <= v_now then 'retry_exhausted'
      else null
    end;

    if v_terminal_reason is not null then
      update private.line_notification_deliveries as delivery
      set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
          finalized_at=v_now,status_reason=v_terminal_reason,updated_at=v_now
      where delivery.id=v_delivery.id;
      continue;
    end if;

    v_new_lease_token := gen_random_uuid();
    update private.line_notification_deliveries as delivery
    set attempt_count=delivery.attempt_count+1,
        first_attempt_at=coalesce(delivery.first_attempt_at,v_now),
        lease_token=v_new_lease_token,
        lease_expires_at=v_now+interval '60 seconds',
        updated_at=v_now
    where delivery.id=v_delivery.id;

    insert into private.line_delivery_attempt_starts(
      delivery_id,attempt_number,lease_token,started_at
    ) values (
      v_delivery.id,(v_delivery.attempt_count+1)::smallint,v_new_lease_token,v_now
    );

    delivery_id := v_delivery.id;
    notification_id := v_delivery.notification_id;
    lease_token := v_new_lease_token;
    retry_key := v_delivery.retry_key;
    attempt_number := (v_delivery.attempt_count+1)::smallint;
    line_user_id := v_context.line_user_id;
    notification_title := v_context.title;
    notification_summary := v_context.summary;
    return next;
  end loop;
end;
$$;

create function private.finalize_line_delivery(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_result_kind text,
  p_http_status integer default null,
  p_retry_after_seconds integer default null,
  p_retry_key_accepted boolean default false,
  p_safe_error_code text default null,
  p_provider_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_delivery record;
  v_attempt_start_id uuid;
  v_outcome text;
  v_reason text;
  v_retryable boolean := false;
  v_next_attempt_at timestamptz;
  v_retry_delay interval;
  v_deadline timestamptz;
begin
  if p_delivery_id is null or p_lease_token is null
     or p_result_kind not in ('http','timeout','network')
     or (p_result_kind='http' and (p_http_status is null or p_http_status not between 100 and 599))
     or (p_result_kind<>'http' and p_http_status is not null)
     or (p_retry_after_seconds is not null and p_retry_after_seconds not between 0 and 82800)
     or (p_safe_error_code is not null and p_safe_error_code <> 'invalid_destination')
     or (p_provider_request_id is not null and (
       char_length(p_provider_request_id) not between 1 and 128
       or p_provider_request_id !~ '^[A-Za-z0-9._:-]+$'
     )) then
    return jsonb_build_object('ok',false,'code','INVALID_RESULT');
  end if;

  select delivery.* into v_delivery
  from private.line_notification_deliveries as delivery
  where delivery.id=p_delivery_id
  for update;

  if not found
     or v_delivery.status not in ('pending','retryable_failure')
     or v_delivery.lease_token is distinct from p_lease_token
     or v_delivery.lease_expires_at is null
     or v_delivery.lease_expires_at <= v_now then
    return jsonb_build_object('ok',false,'code','STALE_LEASE');
  end if;

  select attempt.id into v_attempt_start_id
  from private.line_delivery_attempt_starts as attempt
  where attempt.delivery_id=p_delivery_id
    and attempt.lease_token=p_lease_token
    and attempt.attempt_number=v_delivery.attempt_count;
  if not found then
    return jsonb_build_object('ok',false,'code','ATTEMPT_NOT_FOUND');
  end if;
  if exists (
    select 1 from private.line_delivery_attempt_results as result
    where result.attempt_start_id=v_attempt_start_id
  ) then
    return jsonb_build_object('ok',false,'code','ALREADY_FINALIZED');
  end if;

  if p_result_kind='network' then
    v_outcome := 'retryable_failure'; v_reason := 'network'; v_retryable := true;
  elsif p_result_kind='timeout' then
    v_outcome := 'retryable_failure'; v_reason := 'timeout'; v_retryable := true;
  elsif p_http_status between 200 and 299 then
    v_outcome := 'delivered'; v_reason := 'provider_accepted';
  elsif p_http_status=409 and p_retry_key_accepted and p_provider_request_id is not null then
    v_outcome := 'delivered'; v_reason := 'provider_already_accepted';
  elsif p_http_status=408 then
    v_outcome := 'retryable_failure'; v_reason := 'timeout'; v_retryable := true;
  elsif p_http_status=429 then
    v_outcome := 'retryable_failure'; v_reason := 'rate_limited'; v_retryable := true;
  elsif p_http_status between 500 and 599 then
    v_outcome := 'retryable_failure'; v_reason := 'provider_unavailable'; v_retryable := true;
  elsif p_safe_error_code='invalid_destination' and p_http_status between 400 and 499 then
    v_outcome := 'terminal_failure'; v_reason := 'invalid_destination';
  elsif p_http_status=401 then
    v_outcome := 'terminal_failure'; v_reason := 'provider_auth';
  elsif p_http_status=403 then
    v_outcome := 'terminal_failure'; v_reason := 'provider_forbidden';
  elsif p_http_status=400 then
    v_outcome := 'terminal_failure'; v_reason := 'invalid_request';
  else
    v_outcome := 'terminal_failure'; v_reason := 'provider_rejected';
  end if;

  insert into private.line_delivery_attempt_results(
    attempt_start_id,outcome,reason,http_status,provider_request_id,completed_at
  ) values (
    v_attempt_start_id,v_outcome,v_reason,p_http_status,p_provider_request_id,v_now
  );

  if v_outcome='delivered' then
    update private.line_notification_deliveries as delivery
    set status='delivered',next_attempt_at=null,lease_token=null,lease_expires_at=null,
        finalized_at=v_now,status_reason=v_reason,updated_at=v_now
    where delivery.id=p_delivery_id;
  elsif not v_retryable then
    update private.line_notification_deliveries as delivery
    set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
        finalized_at=v_now,status_reason=v_reason,updated_at=v_now
    where delivery.id=p_delivery_id;
  else
    v_deadline := v_delivery.first_attempt_at + interval '23 hours';
    v_retry_delay := private.line_delivery_retry_delay(v_delivery.attempt_count);
    if p_retry_after_seconds is not null then
      v_retry_delay := greatest(v_retry_delay,make_interval(secs=>p_retry_after_seconds));
    end if;
    v_next_attempt_at := v_now + v_retry_delay;

    if v_delivery.attempt_count >= 4
       or v_retry_delay is null
       or v_now >= v_deadline
       or v_next_attempt_at >= v_deadline then
      update private.line_notification_deliveries as delivery
      set status='terminal_failure',next_attempt_at=null,lease_token=null,lease_expires_at=null,
          finalized_at=v_now,status_reason='retry_exhausted',updated_at=v_now
      where delivery.id=p_delivery_id;
    else
      update private.line_notification_deliveries as delivery
      set status='retryable_failure',next_attempt_at=v_next_attempt_at,
          lease_token=null,lease_expires_at=null,finalized_at=null,
          status_reason=v_reason,updated_at=v_now
      where delivery.id=p_delivery_id;
    end if;
  end if;

  return (
    select jsonb_build_object(
      'ok',true,'status',delivery.status,'reason',delivery.status_reason,
      'attempt_count',delivery.attempt_count,'next_attempt_at',delivery.next_attempt_at
    )
    from private.line_notification_deliveries as delivery
    where delivery.id=p_delivery_id
  );
end;
$$;

alter function private.line_delivery_retry_delay(integer) owner to postgres;
alter function private.claim_line_deliveries(integer) owner to postgres;
alter function private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text) owner to postgres;

revoke all on function private.line_delivery_retry_delay(integer) from public,anon,authenticated,service_role;
revoke all on function private.claim_line_deliveries(integer) from public,anon,authenticated,service_role;
revoke all on function private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text)
  from public,anon,authenticated,service_role;

comment on function private.claim_line_deliveries(integer) is
  'OCV1-07C2 trusted bounded claim. Revalidates Worker/link/consent, recovers expired leases, and atomically appends attempt starts.';
comment on function private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text) is
  'OCV1-07C2 trusted finalize. Requires a live exact lease and appends one controlled provider result without storing response bodies.';
