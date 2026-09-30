-- OCV1-07C2-02: LINE delivery persistence and atomic enqueue only.

create table private.line_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique
    references public.in_app_notifications(id) on delete restrict,
  status text not null default 'pending',
  retry_key uuid not null unique default gen_random_uuid(),
  attempt_count smallint not null default 0,
  next_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  first_attempt_at timestamptz,
  finalized_at timestamptz,
  status_reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint line_notification_deliveries_status_check
    check (status in ('pending','delivered','retryable_failure','terminal_failure')),
  constraint line_notification_deliveries_attempt_count_check
    check (attempt_count between 0 and 4),
  constraint line_notification_deliveries_attempt_time_check
    check (
      (attempt_count = 0 and first_attempt_at is null)
      or (attempt_count > 0 and first_attempt_at is not null)
    ),
  constraint line_notification_deliveries_lease_shape_check
    check ((lease_token is null) = (lease_expires_at is null)),
  constraint line_notification_deliveries_state_shape_check
    check (
      (status = 'pending' and next_attempt_at is not null and finalized_at is null and status_reason is null)
      or (
        status = 'retryable_failure' and next_attempt_at is not null and finalized_at is null
        and status_reason in ('network','timeout','rate_limited','provider_unavailable')
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
    )
);

create index line_notification_deliveries_claimable_idx
  on private.line_notification_deliveries(next_attempt_at,created_at,id)
  where status in ('pending','retryable_failure');

create index line_notification_deliveries_expired_lease_idx
  on private.line_notification_deliveries(lease_expires_at,id)
  where lease_expires_at is not null and status in ('pending','retryable_failure');

create table private.line_delivery_attempt_starts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references private.line_notification_deliveries(id) on delete restrict,
  attempt_number smallint not null,
  lease_token uuid not null unique,
  started_at timestamptz not null default clock_timestamp(),
  constraint line_delivery_attempt_starts_number_check check (attempt_number between 1 and 4),
  constraint line_delivery_attempt_starts_delivery_number_key unique (delivery_id,attempt_number)
);

create index line_delivery_attempt_starts_delivery_idx
  on private.line_delivery_attempt_starts(delivery_id,started_at);

create table private.line_delivery_attempt_results (
  attempt_start_id uuid primary key
    references private.line_delivery_attempt_starts(id) on delete restrict,
  outcome text not null,
  reason text not null,
  http_status integer,
  provider_request_id text,
  completed_at timestamptz not null default clock_timestamp(),
  constraint line_delivery_attempt_results_outcome_check
    check (outcome in ('delivered','retryable_failure','terminal_failure')),
  constraint line_delivery_attempt_results_reason_check
    check (reason in (
      'provider_accepted','provider_already_accepted','network','timeout','rate_limited',
      'provider_unavailable','invalid_request','invalid_destination','provider_forbidden',
      'provider_auth','retry_exhausted','provider_rejected'
    )),
  constraint line_delivery_attempt_results_http_status_check
    check (http_status is null or http_status between 100 and 599),
  constraint line_delivery_attempt_results_request_id_check
    check (
      provider_request_id is null
      or (
        char_length(provider_request_id) between 1 and 128
        and provider_request_id ~ '^[A-Za-z0-9._:-]+$'
      )
    )
);

alter table private.line_notification_deliveries enable row level security;
alter table private.line_delivery_attempt_starts enable row level security;
alter table private.line_delivery_attempt_results enable row level security;

revoke all on table private.line_notification_deliveries from public,anon,authenticated,service_role;
revoke all on table private.line_delivery_attempt_starts from public,anon,authenticated,service_role;
revoke all on table private.line_delivery_attempt_results from public,anon,authenticated,service_role;

create function private.reject_line_delivery_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'LINE delivery attempt evidence is append-only';
end;
$$;

create trigger reject_line_delivery_attempt_start_mutation
before update or delete on private.line_delivery_attempt_starts
for each row execute function private.reject_line_delivery_evidence_mutation();

create trigger reject_line_delivery_attempt_result_mutation
before update or delete on private.line_delivery_attempt_results
for each row execute function private.reject_line_delivery_evidence_mutation();

create function private.enqueue_line_delivery_for_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.notification_type not in (
    'pre_confirmation_reminder','wake_reminder','departure_reminder','arrival_reminder'
  ) then
    return new;
  end if;

  insert into private.line_notification_deliveries(
    notification_id,status,retry_key,attempt_count,next_attempt_at,created_at,updated_at
  )
  select new.id,'pending',gen_random_uuid(),0,new.created_at,new.created_at,new.created_at
  from private.worker_line_links as link
  where link.profile_id = new.recipient_profile_id
    and private.is_active_worker_profile(new.recipient_profile_id)
    and link.destination_status = 'linked_available'
    and link.external_reminders_enabled
    and link.enabled_at is not null
    and new.created_at >= link.enabled_at
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

create trigger enqueue_line_delivery_after_notification_insert
after insert on public.in_app_notifications
for each row execute function private.enqueue_line_delivery_for_notification();

create function private.terminalize_line_deliveries_on_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_reason text;
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'DELETE' then
    v_profile_id := old.profile_id;
    v_reason := 'destination_unlinked';
  else
    if new.destination_status = 'linked_available'
       and new.external_reminders_enabled
       and new.enabled_at is not null then
      return new;
    end if;
    v_profile_id := new.profile_id;
    v_reason := case
      when new.destination_status = 'suspended' then 'worker_inactive'
      when new.destination_status <> 'linked_available' then 'destination_unavailable'
      else 'delivery_disabled'
    end;
  end if;

  update private.line_notification_deliveries as delivery
  set status = 'terminal_failure',
      next_attempt_at = null,
      lease_token = null,
      lease_expires_at = null,
      finalized_at = v_now,
      status_reason = v_reason,
      updated_at = v_now
  from public.in_app_notifications as notification
  where notification.id = delivery.notification_id
    and notification.recipient_profile_id = v_profile_id
    and delivery.status in ('pending','retryable_failure');

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger terminalize_line_deliveries_after_link_update
after update of destination_status,external_reminders_enabled,enabled_at
on private.worker_line_links
for each row execute function private.terminalize_line_deliveries_on_link_change();

create trigger terminalize_line_deliveries_after_link_delete
after delete on private.worker_line_links
for each row execute function private.terminalize_line_deliveries_on_link_change();

alter function private.reject_line_delivery_evidence_mutation() owner to postgres;
alter function private.enqueue_line_delivery_for_notification() owner to postgres;
alter function private.terminalize_line_deliveries_on_link_change() owner to postgres;

revoke all on function private.reject_line_delivery_evidence_mutation() from public,anon,authenticated,service_role;
revoke all on function private.enqueue_line_delivery_for_notification() from public,anon,authenticated,service_role;
revoke all on function private.terminalize_line_deliveries_on_link_change() from public,anon,authenticated,service_role;

comment on table private.line_notification_deliveries is
  'OCV1-07C2 LINE-only delivery state. One row per canonical in-app Notification; contains no destination or message body.';
comment on table private.line_delivery_attempt_starts is
  'OCV1-07C2 append-only provider attempt start evidence. C2-03 will create rows while claiming a delivery.';
comment on table private.line_delivery_attempt_results is
  'OCV1-07C2 append-only provider attempt result evidence. Contains controlled outcomes only and no provider response body.';
