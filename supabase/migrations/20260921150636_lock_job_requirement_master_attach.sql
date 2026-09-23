-- Serialize requirement attachment with master lifecycle changes.

create or replace function private.validate_job_skill_requirement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_active boolean;
begin
  select s.is_active
  into v_is_active
  from public.skills as s
  where s.id = new.skill_id
  for share;

  if v_is_active is null or not v_is_active then
    raise exception using errcode = '23514', message = 'inactive_or_missing_skill';
  end if;
  return new;
end;
$$;

create or replace function private.validate_job_qualification_requirement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_active boolean;
begin
  select q.is_active
  into v_is_active
  from public.qualifications as q
  where q.id = new.qualification_id
  for share;

  if v_is_active is null or not v_is_active then
    raise exception using errcode = '23514', message = 'inactive_or_missing_qualification';
  end if;
  return new;
end;
$$;

alter function private.validate_job_skill_requirement() owner to postgres;
alter function private.validate_job_qualification_requirement() owner to postgres;

revoke all on function private.validate_job_skill_requirement()
  from public, anon, authenticated, service_role;
revoke all on function private.validate_job_qualification_requirement()
  from public, anon, authenticated, service_role;
