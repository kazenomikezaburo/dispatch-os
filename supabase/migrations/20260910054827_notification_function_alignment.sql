create or replace function public.project_incident_in_app_notification(
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

alter function public.project_incident_in_app_notification(uuid) owner to postgres;
revoke all on function public.project_incident_in_app_notification(uuid) from public;
revoke all on function public.project_incident_in_app_notification(uuid) from anon;
grant execute on function public.project_incident_in_app_notification(uuid) to authenticated;
