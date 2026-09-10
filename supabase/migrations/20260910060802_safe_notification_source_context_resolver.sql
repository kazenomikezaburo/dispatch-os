create function public.resolve_in_app_notification_source_context(
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

  select a.id into v_assignment_id
  from public.in_app_notifications as n
  join public.operational_incident_events as e
    on e.id = n.source_incident_event_id
  join public.operational_incidents as i
    on i.id = e.incident_id
  join public.assignments as a
    on a.id = i.assignment_id
  where n.id = p_notification_id
    and n.recipient_profile_id = v_actor_id
    and n.notification_type in ('incident_acknowledged', 'incident_resolved')
    and e.event_type in ('acknowledged', 'resolved')
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

comment on function public.resolve_in_app_notification_source_context(uuid) is
  'Resolves an active Worker own Incident notification to a currently owned Assignment without exposing Incident internals.';

alter function public.resolve_in_app_notification_source_context(uuid) owner to postgres;
revoke all on function public.resolve_in_app_notification_source_context(uuid) from public;
revoke all on function public.resolve_in_app_notification_source_context(uuid) from anon;
revoke all on function public.resolve_in_app_notification_source_context(uuid) from service_role;
grant execute on function public.resolve_in_app_notification_source_context(uuid) to authenticated;
