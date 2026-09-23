-- Preserve inactive-master holdings while still rejecting new holdings.
-- UPDATE-first avoids firing INSERT validation before ON CONFLICT resolves.

create or replace function public.set_worker_skill_holding(
  p_worker_id uuid,
  p_skill_id uuid,
  p_acquired_on date,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_system_admin() then
    raise exception using errcode = '42501', message = 'staff_holding_forbidden';
  end if;

  update public.worker_skills
  set acquired_on = p_acquired_on,
      is_active = p_is_active
  where worker_id = p_worker_id
    and skill_id = p_skill_id;

  if not found then
    insert into public.worker_skills (worker_id, skill_id, acquired_on, is_active)
    values (p_worker_id, p_skill_id, p_acquired_on, p_is_active);
  end if;

  return jsonb_build_object(
    'ok', true,
    'worker_id', p_worker_id,
    'skill_id', p_skill_id
  );
end;
$$;

create or replace function public.set_worker_qualification_holding(
  p_worker_id uuid,
  p_qualification_id uuid,
  p_credential_number text,
  p_issued_on date,
  p_valid_from date,
  p_expires_on date,
  p_revoked_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_system_admin() then
    raise exception using errcode = '42501', message = 'staff_holding_forbidden';
  end if;

  update public.worker_qualifications
  set credential_number = p_credential_number,
      issued_on = p_issued_on,
      valid_from = p_valid_from,
      expires_on = p_expires_on,
      revoked_at = p_revoked_at
  where worker_id = p_worker_id
    and qualification_id = p_qualification_id;

  if not found then
    insert into public.worker_qualifications (
      worker_id,
      qualification_id,
      credential_number,
      issued_on,
      valid_from,
      expires_on,
      revoked_at
    )
    values (
      p_worker_id,
      p_qualification_id,
      p_credential_number,
      p_issued_on,
      p_valid_from,
      p_expires_on,
      p_revoked_at
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'worker_id', p_worker_id,
    'qualification_id', p_qualification_id
  );
end;
$$;

alter function public.set_worker_skill_holding(uuid, uuid, date, boolean)
  owner to postgres;
alter function public.set_worker_qualification_holding(uuid, uuid, text, date, date, date, timestamptz)
  owner to postgres;

revoke all on function public.set_worker_skill_holding(uuid, uuid, date, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.set_worker_qualification_holding(uuid, uuid, text, date, date, date, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function public.set_worker_skill_holding(uuid, uuid, date, boolean)
  to authenticated;
grant execute on function public.set_worker_qualification_holding(uuid, uuid, text, date, date, date, timestamptz)
  to authenticated;
