-- STAFF-2B: canonical Skill / Qualification masters and current Staff holdings.

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_code_not_blank check (btrim(code) <> ''),
  constraint skills_code_canonical check (
    code = upper(btrim(code))
    and code ~ '^[A-Z0-9][A-Z0-9._-]*$'
  ),
  constraint skills_name_not_blank check (btrim(name) <> '')
);

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  expiry_policy text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qualifications_code_not_blank check (btrim(code) <> ''),
  constraint qualifications_code_canonical check (
    code = upper(btrim(code))
    and code ~ '^[A-Z0-9][A-Z0-9._-]*$'
  ),
  constraint qualifications_name_not_blank check (btrim(name) <> ''),
  constraint qualifications_expiry_policy_check
    check (expiry_policy in ('none', 'optional', 'required'))
);

create table public.worker_skills (
  worker_id uuid not null,
  skill_id uuid not null,
  acquired_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_skills_pkey primary key (worker_id, skill_id),
  constraint worker_skills_worker_fkey
    foreign key (worker_id) references public.workers(id) on delete restrict,
  constraint worker_skills_skill_fkey
    foreign key (skill_id) references public.skills(id) on delete restrict
);

create table public.worker_qualifications (
  worker_id uuid not null,
  qualification_id uuid not null,
  credential_number text,
  issued_on date,
  valid_from date,
  expires_on date,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_qualifications_pkey primary key (worker_id, qualification_id),
  constraint worker_qualifications_worker_fkey
    foreign key (worker_id) references public.workers(id) on delete restrict,
  constraint worker_qualifications_qualification_fkey
    foreign key (qualification_id) references public.qualifications(id) on delete restrict,
  constraint worker_qualifications_credential_not_blank
    check (credential_number is null or btrim(credential_number) <> ''),
  constraint worker_qualifications_valid_dates
    check (expires_on is null or valid_from is null or expires_on >= valid_from)
);

create index worker_skills_skill_active_idx
  on public.worker_skills(skill_id, is_active, worker_id);
create index worker_qualifications_qualification_idx
  on public.worker_qualifications(qualification_id, worker_id);

create function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.is_active
      and p.account_type in ('manager', 'system_admin')
  );
$$;

create function private.normalize_staff_master_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');

  if tg_op = 'UPDATE' and new.code is distinct from old.code then
    raise exception using
      errcode = '22023',
      message = 'master_code_immutable';
  end if;

  return new;
end;
$$;

create function private.validate_qualification_master_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expiry_policy is distinct from old.expiry_policy then
    if new.expiry_policy = 'none' and exists (
      select 1
      from public.worker_qualifications as wq
      where wq.qualification_id = new.id
        and wq.expires_on is not null
    ) then
      raise exception using
        errcode = '23514',
        message = 'qualification_policy_conflicts_with_holdings';
    end if;

    if new.expiry_policy = 'required' and exists (
      select 1
      from public.worker_qualifications as wq
      where wq.qualification_id = new.id
        and wq.expires_on is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'qualification_policy_conflicts_with_holdings';
    end if;
  end if;

  return new;
end;
$$;

create function private.validate_worker_skill_holding()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_master_active boolean;
begin
  if tg_op = 'UPDATE' and (
    new.worker_id is distinct from old.worker_id
    or new.skill_id is distinct from old.skill_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'worker_skill_identity_immutable';
  end if;

  select s.is_active
  into v_master_active
  from public.skills as s
  where s.id = new.skill_id;

  if v_master_active is null then
    raise exception using
      errcode = '23503',
      message = 'skill_not_found';
  end if;

  if (tg_op = 'INSERT' or (not old.is_active and new.is_active))
    and not v_master_active then
    raise exception using
      errcode = '23514',
      message = 'inactive_skill';
  end if;

  return new;
end;
$$;

create function private.validate_worker_qualification_holding()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_master public.qualifications%rowtype;
begin
  if tg_op = 'UPDATE' and (
    new.worker_id is distinct from old.worker_id
    or new.qualification_id is distinct from old.qualification_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'worker_qualification_identity_immutable';
  end if;

  select q.*
  into v_master
  from public.qualifications as q
  where q.id = new.qualification_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'qualification_not_found';
  end if;

  if (tg_op = 'INSERT' or (old.revoked_at is not null and new.revoked_at is null))
    and not v_master.is_active then
    raise exception using
      errcode = '23514',
      message = 'inactive_qualification';
  end if;

  if v_master.expiry_policy = 'none' and new.expires_on is not null then
    raise exception using
      errcode = '23514',
      message = 'qualification_expiry_forbidden';
  end if;

  if v_master.expiry_policy = 'required' and new.expires_on is null then
    raise exception using
      errcode = '23514',
      message = 'qualification_expiry_required';
  end if;

  new.credential_number := nullif(btrim(new.credential_number), '');
  return new;
end;
$$;

create trigger normalize_skills
before insert or update on public.skills
for each row execute function private.normalize_staff_master_row();

create trigger normalize_qualifications
before insert or update on public.qualifications
for each row execute function private.normalize_staff_master_row();

create trigger validate_qualification_master_change
before update on public.qualifications
for each row execute function private.validate_qualification_master_change();

create trigger validate_worker_skill_holding
before insert or update on public.worker_skills
for each row execute function private.validate_worker_skill_holding();

create trigger validate_worker_qualification_holding
before insert or update on public.worker_qualifications
for each row execute function private.validate_worker_qualification_holding();

create trigger set_skills_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

create trigger set_qualifications_updated_at
before update on public.qualifications
for each row execute function public.set_updated_at();

create trigger set_worker_skills_updated_at
before update on public.worker_skills
for each row execute function public.set_updated_at();

create trigger set_worker_qualifications_updated_at
before update on public.worker_qualifications
for each row execute function public.set_updated_at();

alter table public.skills enable row level security;
alter table public.qualifications enable row level security;
alter table public.worker_skills enable row level security;
alter table public.worker_qualifications enable row level security;

create policy "Active admins can view Skill master"
on public.skills for select to authenticated
using (private.is_active_admin());

create policy "Active admins can view Qualification master"
on public.qualifications for select to authenticated
using (private.is_active_admin());

create policy "Admins can view authorized Worker Skills"
on public.worker_skills for select to authenticated
using (
  private.is_active_admin()
  and exists (
    select 1
    from public.workers as w
    where w.id = worker_skills.worker_id
      and private.has_branch_access(w.branch_id)
  )
);

create policy "Admins can view authorized Worker Qualifications"
on public.worker_qualifications for select to authenticated
using (
  private.is_active_admin()
  and exists (
    select 1
    from public.workers as w
    where w.id = worker_qualifications.worker_id
      and private.has_branch_access(w.branch_id)
  )
);

revoke all privileges on table public.skills from public, anon, authenticated;
revoke all privileges on table public.qualifications from public, anon, authenticated;
revoke all privileges on table public.worker_skills from public, anon, authenticated;
revoke all privileges on table public.worker_qualifications from public, anon, authenticated;

grant select on table public.skills to authenticated;
grant select on table public.qualifications to authenticated;
grant select on table public.worker_skills to authenticated;
grant select on table public.worker_qualifications to authenticated;

create function public.create_skill_master(
  p_code text,
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_system_admin() then
    raise exception using errcode = '42501', message = 'staff_master_forbidden';
  end if;

  insert into public.skills (code, name, description)
  values (p_code, p_name, p_description)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.update_skill_master(
  p_skill_id uuid,
  p_name text,
  p_description text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_system_admin() then
    raise exception using errcode = '42501', message = 'staff_master_forbidden';
  end if;

  update public.skills
  set name = p_name,
      description = p_description,
      is_active = p_is_active
  where id = p_skill_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'skill_not_found';
  end if;

  return p_skill_id;
end;
$$;

create function public.create_qualification_master(
  p_code text,
  p_name text,
  p_description text,
  p_expiry_policy text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_system_admin() then
    raise exception using errcode = '42501', message = 'staff_master_forbidden';
  end if;

  insert into public.qualifications (code, name, description, expiry_policy)
  values (p_code, p_name, p_description, p_expiry_policy)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.update_qualification_master(
  p_qualification_id uuid,
  p_name text,
  p_description text,
  p_expiry_policy text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_system_admin() then
    raise exception using errcode = '42501', message = 'staff_master_forbidden';
  end if;

  update public.qualifications
  set name = p_name,
      description = p_description,
      expiry_policy = p_expiry_policy,
      is_active = p_is_active
  where id = p_qualification_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'qualification_not_found';
  end if;

  return p_qualification_id;
end;
$$;

create function public.set_worker_skill_holding(
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

  insert into public.worker_skills (worker_id, skill_id, acquired_on, is_active)
  values (p_worker_id, p_skill_id, p_acquired_on, p_is_active)
  on conflict (worker_id, skill_id) do update
  set acquired_on = excluded.acquired_on,
      is_active = excluded.is_active;

  return jsonb_build_object(
    'ok', true,
    'worker_id', p_worker_id,
    'skill_id', p_skill_id
  );
end;
$$;

create function public.set_worker_qualification_holding(
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
  )
  on conflict (worker_id, qualification_id) do update
  set credential_number = excluded.credential_number,
      issued_on = excluded.issued_on,
      valid_from = excluded.valid_from,
      expires_on = excluded.expires_on,
      revoked_at = excluded.revoked_at;

  return jsonb_build_object(
    'ok', true,
    'worker_id', p_worker_id,
    'qualification_id', p_qualification_id
  );
end;
$$;

comment on table public.skills is 'Canonical active/inactive Skill master.';
comment on table public.qualifications is 'Canonical Qualification master with credential expiry policy.';
comment on table public.worker_skills is 'One current Skill holding fact per Worker and Skill.';
comment on table public.worker_qualifications is 'One current Qualification credential fact per Worker and Qualification.';

alter function private.is_active_admin() owner to postgres;
alter function private.normalize_staff_master_row() owner to postgres;
alter function private.validate_qualification_master_change() owner to postgres;
alter function private.validate_worker_skill_holding() owner to postgres;
alter function private.validate_worker_qualification_holding() owner to postgres;
alter function public.create_skill_master(text, text, text) owner to postgres;
alter function public.update_skill_master(uuid, text, text, boolean) owner to postgres;
alter function public.create_qualification_master(text, text, text, text) owner to postgres;
alter function public.update_qualification_master(uuid, text, text, text, boolean) owner to postgres;
alter function public.set_worker_skill_holding(uuid, uuid, date, boolean) owner to postgres;
alter function public.set_worker_qualification_holding(uuid, uuid, text, date, date, date, timestamptz) owner to postgres;

revoke all on function private.is_active_admin()
  from public, anon, authenticated, service_role;
revoke all on function private.normalize_staff_master_row()
  from public, anon, authenticated, service_role;
revoke all on function private.validate_qualification_master_change()
  from public, anon, authenticated, service_role;
revoke all on function private.validate_worker_skill_holding()
  from public, anon, authenticated, service_role;
revoke all on function private.validate_worker_qualification_holding()
  from public, anon, authenticated, service_role;

revoke all on function public.create_skill_master(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.update_skill_master(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.create_qualification_master(text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.update_qualification_master(uuid, text, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.set_worker_skill_holding(uuid, uuid, date, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.set_worker_qualification_holding(uuid, uuid, text, date, date, date, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function public.create_skill_master(text, text, text) to authenticated;
grant execute on function public.update_skill_master(uuid, text, text, boolean) to authenticated;
grant execute on function public.create_qualification_master(text, text, text, text) to authenticated;
grant execute on function public.update_qualification_master(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.set_worker_skill_holding(uuid, uuid, date, boolean) to authenticated;
grant execute on function public.set_worker_qualification_holding(uuid, uuid, text, date, date, date, timestamptz) to authenticated;
