-- STAFF-2C: structured Job requirements and Shift-date requirement facts.

create table public.job_skill_requirements (
  job_id uuid not null,
  skill_id uuid not null,
  created_at timestamptz not null default now(),
  constraint job_skill_requirements_pkey primary key (job_id, skill_id),
  constraint job_skill_requirements_job_fkey
    foreign key (job_id) references public.jobs(id) on delete restrict,
  constraint job_skill_requirements_skill_fkey
    foreign key (skill_id) references public.skills(id) on delete restrict
);

create table public.job_qualification_requirements (
  job_id uuid not null,
  qualification_id uuid not null,
  created_at timestamptz not null default now(),
  constraint job_qualification_requirements_pkey
    primary key (job_id, qualification_id),
  constraint job_qualification_requirements_job_fkey
    foreign key (job_id) references public.jobs(id) on delete restrict,
  constraint job_qualification_requirements_qualification_fkey
    foreign key (qualification_id) references public.qualifications(id) on delete restrict
);

create index job_skill_requirements_skill_idx
  on public.job_skill_requirements(skill_id, job_id);
create index job_qualification_requirements_qualification_idx
  on public.job_qualification_requirements(qualification_id, job_id);

create function private.can_manage_job_requirements(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_admin()
    and exists (
      select 1
      from public.jobs as j
      join public.projects as p on p.id = j.project_id
      where j.id = p_job_id
        and private.has_branch_access(p.branch_id)
    );
$$;

create function private.validate_job_skill_requirement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.skills as s
    where s.id = new.skill_id and s.is_active
  ) then
    raise exception using errcode = '23514', message = 'inactive_or_missing_skill';
  end if;
  return new;
end;
$$;

create function private.validate_job_qualification_requirement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.qualifications as q
    where q.id = new.qualification_id and q.is_active
  ) then
    raise exception using errcode = '23514', message = 'inactive_or_missing_qualification';
  end if;
  return new;
end;
$$;

create trigger validate_job_skill_requirement
before insert on public.job_skill_requirements
for each row execute function private.validate_job_skill_requirement();

create trigger validate_job_qualification_requirement
before insert on public.job_qualification_requirements
for each row execute function private.validate_job_qualification_requirement();

alter table public.job_skill_requirements enable row level security;
alter table public.job_qualification_requirements enable row level security;

create policy "Admins can view authorized Job Skill requirements"
on public.job_skill_requirements for select to authenticated
using (private.can_manage_job_requirements(job_id));

create policy "Admins can view authorized Job Qualification requirements"
on public.job_qualification_requirements for select to authenticated
using (private.can_manage_job_requirements(job_id));

revoke all privileges on table public.job_skill_requirements
  from public, anon, authenticated;
revoke all privileges on table public.job_qualification_requirements
  from public, anon, authenticated;
grant select on table public.job_skill_requirements to authenticated;
grant select on table public.job_qualification_requirements to authenticated;

create function public.add_job_skill_requirement(
  p_job_id uuid,
  p_skill_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_job_requirements(p_job_id) then
    raise exception using errcode = 'P0002', message = 'job_requirement_unavailable';
  end if;

  insert into public.job_skill_requirements (job_id, skill_id)
  values (p_job_id, p_skill_id);

  return jsonb_build_object('ok', true, 'jobId', p_job_id, 'skillId', p_skill_id);
end;
$$;

create function public.remove_job_skill_requirement(
  p_job_id uuid,
  p_skill_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed boolean;
begin
  if not private.can_manage_job_requirements(p_job_id) then
    raise exception using errcode = 'P0002', message = 'job_requirement_unavailable';
  end if;

  delete from public.job_skill_requirements
  where job_id = p_job_id and skill_id = p_skill_id;
  v_removed := found;

  return jsonb_build_object('ok', true, 'removed', v_removed);
end;
$$;

create function public.add_job_qualification_requirement(
  p_job_id uuid,
  p_qualification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_job_requirements(p_job_id) then
    raise exception using errcode = 'P0002', message = 'job_requirement_unavailable';
  end if;

  insert into public.job_qualification_requirements (job_id, qualification_id)
  values (p_job_id, p_qualification_id);

  return jsonb_build_object(
    'ok', true,
    'jobId', p_job_id,
    'qualificationId', p_qualification_id
  );
end;
$$;

create function public.remove_job_qualification_requirement(
  p_job_id uuid,
  p_qualification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed boolean;
begin
  if not private.can_manage_job_requirements(p_job_id) then
    raise exception using errcode = 'P0002', message = 'job_requirement_unavailable';
  end if;

  delete from public.job_qualification_requirements
  where job_id = p_job_id and qualification_id = p_qualification_id;
  v_removed := found;

  return jsonb_build_object('ok', true, 'removed', v_removed);
end;
$$;

create function public.get_worker_shift_requirement_facts(
  p_worker_id uuid,
  p_shift_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_shift_branch_id uuid;
  v_worker_branch_id uuid;
  v_starts_at timestamptz;
  v_evaluation_date date;
  v_result jsonb;
begin
  select ss.job_id, p.branch_id, ss.starts_at
  into v_job_id, v_shift_branch_id, v_starts_at
  from public.shift_slots as ss
  join public.jobs as j on j.id = ss.job_id
  join public.projects as p on p.id = j.project_id
  where ss.id = p_shift_id;

  select w.branch_id
  into v_worker_branch_id
  from public.workers as w
  where w.id = p_worker_id;

  if v_job_id is null
    or v_worker_branch_id is null
    or not private.is_active_admin()
    or not private.has_branch_access(v_shift_branch_id)
    or not private.has_branch_access(v_worker_branch_id) then
    return jsonb_build_object(
      'ok', true,
      'sourceAvailable', false,
      'requirementsEligible', false,
      'reasonCodes', '[]'::jsonb,
      'requirements', '[]'::jsonb
    );
  end if;

  v_evaluation_date := (v_starts_at at time zone 'Asia/Tokyo')::date;

  with requirement_facts as (
    select
      'skill'::text as requirement_kind,
      s.id as master_id,
      s.code,
      s.name,
      case
        when not s.is_active then 'requirement_master_inactive'
        when ws.worker_id is not null then 'satisfied'
        else 'missing'
      end as state,
      null::date as valid_from,
      null::date as expires_on
    from public.job_skill_requirements as jsr
    join public.skills as s on s.id = jsr.skill_id
    left join public.worker_skills as ws
      on ws.worker_id = p_worker_id
      and ws.skill_id = jsr.skill_id
      and ws.is_active
    where jsr.job_id = v_job_id

    union all

    select
      'qualification'::text,
      q.id,
      q.code,
      q.name,
      case
        when not q.is_active then 'requirement_master_inactive'
        when wq.worker_id is null then 'missing'
        when wq.revoked_at is not null then 'revoked'
        when wq.valid_from is not null and wq.valid_from > v_evaluation_date
          then 'not_yet_valid'
        when wq.expires_on is not null and wq.expires_on < v_evaluation_date
          then 'expired'
        else 'satisfied'
      end,
      wq.valid_from,
      wq.expires_on
    from public.job_qualification_requirements as jqr
    join public.qualifications as q on q.id = jqr.qualification_id
    left join public.worker_qualifications as wq
      on wq.worker_id = p_worker_id
      and wq.qualification_id = jqr.qualification_id
    where jqr.job_id = v_job_id
  ), reason_codes as (
    select distinct case
      when state = 'missing' and requirement_kind = 'skill' then 'skill_missing'
      when state = 'missing' then 'qualification_missing'
      when state = 'not_yet_valid' then 'qualification_not_yet_valid'
      when state = 'expired' then 'qualification_expired'
      when state = 'revoked' then 'qualification_revoked'
      when state = 'requirement_master_inactive' then 'requirement_master_inactive'
      else null
    end as reason_code
    from requirement_facts
  )
  select jsonb_build_object(
    'ok', true,
    'sourceAvailable', true,
    'workerId', p_worker_id,
    'shiftId', p_shift_id,
    'jobId', v_job_id,
    'shiftStartsAt', v_starts_at,
    'evaluationDate', v_evaluation_date,
    'requirementsEligible', not exists (
      select 1 from requirement_facts where state <> 'satisfied'
    ),
    'reasonCodes', coalesce((
      select jsonb_agg(reason_code order by reason_code)
      from reason_codes where reason_code is not null
    ), '[]'::jsonb),
    'requirements', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'kind', requirement_kind,
          'masterId', master_id,
          'code', code,
          'name', name,
          'state', state,
          'validFrom', valid_from,
          'expiresOn', expires_on
        ))
        order by requirement_kind, code, master_id
      )
      from requirement_facts
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

alter function private.can_manage_job_requirements(uuid) owner to postgres;
alter function private.validate_job_skill_requirement() owner to postgres;
alter function private.validate_job_qualification_requirement() owner to postgres;
alter function public.add_job_skill_requirement(uuid, uuid) owner to postgres;
alter function public.remove_job_skill_requirement(uuid, uuid) owner to postgres;
alter function public.add_job_qualification_requirement(uuid, uuid) owner to postgres;
alter function public.remove_job_qualification_requirement(uuid, uuid) owner to postgres;
alter function public.get_worker_shift_requirement_facts(uuid, uuid) owner to postgres;

revoke all on function private.can_manage_job_requirements(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.validate_job_skill_requirement()
  from public, anon, authenticated, service_role;
revoke all on function private.validate_job_qualification_requirement()
  from public, anon, authenticated, service_role;
revoke all on function public.add_job_skill_requirement(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.remove_job_skill_requirement(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.add_job_qualification_requirement(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.remove_job_qualification_requirement(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_worker_shift_requirement_facts(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.can_manage_job_requirements(uuid) to authenticated;
grant execute on function public.add_job_skill_requirement(uuid, uuid) to authenticated;
grant execute on function public.remove_job_skill_requirement(uuid, uuid) to authenticated;
grant execute on function public.add_job_qualification_requirement(uuid, uuid) to authenticated;
grant execute on function public.remove_job_qualification_requirement(uuid, uuid) to authenticated;
grant execute on function public.get_worker_shift_requirement_facts(uuid, uuid) to authenticated;
