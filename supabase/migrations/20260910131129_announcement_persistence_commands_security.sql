-- DB-2.9B: Announcement persistence, commands, read contracts, and security.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  state text not null default 'draft',
  version bigint not null default 1,
  scope_type text not null,
  branch_id uuid,
  title text not null default '',
  body text not null default '',
  importance text not null default 'normal',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  published_at timestamptz,
  published_by uuid,
  archived_at timestamptz,
  archived_by uuid,
  constraint announcements_branch_id_fkey foreign key (branch_id)
    references public.branches(id) on delete restrict,
  constraint announcements_created_by_fkey foreign key (created_by)
    references public.profiles(id) on delete set null,
  constraint announcements_updated_by_fkey foreign key (updated_by)
    references public.profiles(id) on delete set null,
  constraint announcements_published_by_fkey foreign key (published_by)
    references public.profiles(id) on delete set null,
  constraint announcements_archived_by_fkey foreign key (archived_by)
    references public.profiles(id) on delete set null,
  constraint announcements_state_check check (state in ('draft', 'published', 'archived')),
  constraint announcements_version_check check (version >= 1),
  constraint announcements_scope_type_check check (scope_type in ('organization', 'branch')),
  constraint announcements_scope_shape_check check (
    (scope_type = 'organization' and branch_id is null)
    or (scope_type = 'branch' and branch_id is not null)
  ),
  constraint announcements_title_check check (
    title = btrim(title) and char_length(title) <= 120
  ),
  constraint announcements_body_check check (
    body = btrim(body) and char_length(body) <= 5000
  ),
  constraint announcements_importance_check check (importance in ('normal', 'important')),
  constraint announcements_lifecycle_audit_check check (
    (state = 'draft'
      and published_at is null and published_by is null
      and archived_at is null and archived_by is null)
    or (state = 'published'
      and published_at is not null
      and archived_at is null and archived_by is null)
    or (state = 'archived'
      and published_at is not null and archived_at is not null)
  ),
  constraint announcements_timestamp_order_check check (
    updated_at >= created_at
    and (published_at is null or published_at >= created_at)
    and (archived_at is null or published_at is null or archived_at >= published_at)
  )
);

create index announcements_state_publication_idx
  on public.announcements(state, published_at desc, id desc);
create index announcements_branch_state_publication_idx
  on public.announcements(branch_id, state, published_at desc, id desc)
  where scope_type = 'branch';
create index announcements_admin_sort_idx
  on public.announcements((coalesce(published_at, created_at)) desc, id desc);

create table public.announcement_recipients (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null,
  worker_id uuid not null,
  recipient_profile_id uuid not null,
  created_at timestamptz not null default now(),
  constraint announcement_recipients_announcement_id_fkey foreign key (announcement_id)
    references public.announcements(id) on delete restrict,
  constraint announcement_recipients_worker_id_fkey foreign key (worker_id)
    references public.workers(id) on delete restrict,
  constraint announcement_recipients_profile_id_fkey foreign key (recipient_profile_id)
    references public.profiles(id) on delete restrict,
  constraint announcement_recipients_announcement_worker_key unique (announcement_id, worker_id),
  constraint announcement_recipients_announcement_profile_key unique (announcement_id, recipient_profile_id)
);

create index announcement_recipients_profile_announcement_idx
  on public.announcement_recipients(recipient_profile_id, announcement_id);

create table private.announcement_command_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null,
  command_name text not null,
  idempotency_key text not null,
  request_snapshot jsonb not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint announcement_command_receipts_command_check check (
    command_name in ('create_draft', 'update_draft', 'publish', 'archive', 'delete_draft')
  ),
  constraint announcement_command_receipts_key_check check (
    idempotency_key = btrim(idempotency_key)
    and idempotency_key <> ''
    and char_length(idempotency_key) <= 128
  ),
  constraint announcement_command_receipts_request_check check (jsonb_typeof(request_snapshot) = 'object'),
  constraint announcement_command_receipts_result_check check (jsonb_typeof(result_snapshot) = 'object'),
  constraint announcement_command_receipts_actor_command_key
    unique (actor_profile_id, command_name, idempotency_key)
);

alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
alter table private.announcement_command_receipts enable row level security;

create function private.active_announcement_admin_type()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.account_type
  from public.profiles as p
  where p.id = (select auth.uid())
    and p.is_active = true
    and p.account_type in ('manager', 'system_admin');
$$;

create function private.can_admin_announcement_scope(target_scope_type text, target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.active_announcement_admin_type()
    when 'system_admin' then
      target_scope_type = 'organization'
      or (
        target_scope_type = 'branch'
        and exists (
          select 1 from public.branches as b
          where b.id = target_branch_id and b.is_active = true
        )
      )
    when 'manager' then
      target_scope_type = 'branch'
      and exists (
        select 1
        from public.manager_branch_access as mba
        join public.branches as b on b.id = mba.branch_id and b.is_active = true
        where mba.profile_id = (select auth.uid())
          and mba.branch_id = target_branch_id
      )
    else false
  end;
$$;

create function private.can_worker_read_announcement(target_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.announcements as a
    join public.announcement_recipients as ar on ar.announcement_id = a.id
    join public.workers as w
      on w.id = ar.worker_id
      and w.auth_profile_id = ar.recipient_profile_id
      and w.status = 'active'
    join public.profiles as p
      on p.id = ar.recipient_profile_id
      and p.account_type = 'worker'
      and p.is_active = true
    where a.id = target_announcement_id
      and a.state = 'published'
      and ar.recipient_profile_id = (select auth.uid())
  );
$$;

create policy "Admins can view authorized announcements"
on public.announcements for select to authenticated
using (private.can_admin_announcement_scope(scope_type, branch_id));

create policy "Workers can view targeted published announcements"
on public.announcements for select to authenticated
using (private.can_worker_read_announcement(id));

create policy "Admins can view authorized announcement recipients"
on public.announcement_recipients for select to authenticated
using (
  exists (
    select 1 from public.announcements as a
    where a.id = announcement_id
      and private.can_admin_announcement_scope(a.scope_type, a.branch_id)
  )
);

create policy "Workers can view own announcement recipient"
on public.announcement_recipients for select to authenticated
using (
  recipient_profile_id = (select auth.uid())
  and private.can_worker_read_announcement(announcement_id)
);

create function private.enforce_announcement_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state = 'draft' then
    if new.state = 'draft' then
      if new.version <> old.version + 1 then
        raise exception 'announcement draft mutation requires adjacent version';
      end if;
      return new;
    end if;
    if new.state = 'published' then
      if new.version <> old.version + 1
        or new.title <> old.title or new.body <> old.body
        or new.importance <> old.importance or new.scope_type <> old.scope_type
        or new.branch_id is distinct from old.branch_id
        or new.published_at is null then
        raise exception 'invalid announcement publication transition';
      end if;
      return new;
    end if;
  elsif old.state = 'published' and new.state = 'archived' then
    if new.version <> old.version + 1
      or new.title <> old.title or new.body <> old.body
      or new.importance <> old.importance or new.scope_type <> old.scope_type
      or new.branch_id is distinct from old.branch_id
      or new.published_at is distinct from old.published_at
      or new.published_by is distinct from old.published_by
      or new.archived_at is null then
      raise exception 'invalid announcement archive transition';
    end if;
    return new;
  end if;
  raise exception 'announcement lifecycle is immutable';
end;
$$;

create trigger enforce_announcement_lifecycle
before update on public.announcements
for each row execute function private.enforce_announcement_lifecycle();

create function private.enforce_announcement_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state <> 'draft' or old.published_at is not null
    or exists (select 1 from public.announcement_recipients as ar where ar.announcement_id = old.id) then
    raise exception 'only unpublished recipient-free announcement drafts can be deleted';
  end if;
  return old;
end;
$$;

create trigger enforce_announcement_delete
before delete on public.announcements
for each row execute function private.enforce_announcement_delete();

create function private.enforce_announcement_recipient_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'announcement recipients are immutable';
  end if;
  if not exists (
    select 1 from public.announcements as a
    where a.id = new.announcement_id and a.state = 'draft' and a.published_at is null
  ) then
    raise exception 'announcement recipients can only be created during publication';
  end if;
  return new;
end;
$$;

create trigger enforce_announcement_recipient_immutability
before insert or update or delete on public.announcement_recipients
for each row execute function private.enforce_announcement_recipient_immutability();

create function public.create_announcement_draft(
  p_scope_type text,
  p_branch_id uuid,
  p_title text,
  p_body text,
  p_importance text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_scope_type text := btrim(coalesce(p_scope_type, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_importance text := btrim(coalesce(p_importance, ''));
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb;
  v_prior record;
  v_result jsonb;
  v_id uuid;
begin
  if v_actor_id is null or v_scope_type not in ('organization', 'branch')
    or (v_scope_type = 'organization' and p_branch_id is not null)
    or (v_scope_type = 'branch' and p_branch_id is null)
    or char_length(v_title) > 120 or char_length(v_body) > 5000
    or v_importance not in ('normal', 'important')
    or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  if private.active_announcement_admin_type() is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not private.can_admin_announcement_scope(v_scope_type, p_branch_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  v_request := jsonb_build_object('scope_type', v_scope_type, 'branch_id', p_branch_id,
    'title', v_title, 'body', v_body, 'importance', v_importance);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':create_draft:' || v_key, 0));
  select request_snapshot, result_snapshot into v_prior
  from private.announcement_command_receipts
  where actor_profile_id = v_actor_id and command_name = 'create_draft' and idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_prior.result_snapshot || jsonb_build_object('replayed', true);
  end if;
  insert into public.announcements
    (scope_type, branch_id, title, body, importance, created_by, updated_by)
  values (v_scope_type, p_branch_id, v_title, v_body, v_importance, v_actor_id, v_actor_id)
  returning id into v_id;
  v_result := jsonb_build_object('ok', true, 'announcement_id', v_id, 'state', 'draft', 'version', 1, 'replayed', false);
  insert into private.announcement_command_receipts
    (actor_profile_id, command_name, idempotency_key, request_snapshot, result_snapshot)
  values (v_actor_id, 'create_draft', v_key, v_request, v_result);
  return v_result;
end;
$$;

create function public.update_announcement_draft(
  p_announcement_id uuid,
  p_expected_version bigint,
  p_scope_type text,
  p_branch_id uuid,
  p_title text,
  p_body text,
  p_importance text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_scope_type text := btrim(coalesce(p_scope_type, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_importance text := btrim(coalesce(p_importance, ''));
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb;
  v_prior record;
  v_row record;
  v_result jsonb;
begin
  if p_announcement_id is null or p_expected_version is null or p_expected_version < 1
    or v_scope_type not in ('organization', 'branch')
    or (v_scope_type = 'organization' and p_branch_id is not null)
    or (v_scope_type = 'branch' and p_branch_id is null)
    or char_length(v_title) > 120 or char_length(v_body) > 5000
    or v_importance not in ('normal', 'important')
    or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  if private.active_announcement_admin_type() is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not private.can_admin_announcement_scope(v_scope_type, p_branch_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  v_request := jsonb_build_object('announcement_id', p_announcement_id, 'expected_version', p_expected_version,
    'scope_type', v_scope_type, 'branch_id', p_branch_id, 'title', v_title, 'body', v_body, 'importance', v_importance);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':update_draft:' || v_key, 0));
  select request_snapshot, result_snapshot into v_prior from private.announcement_command_receipts
  where actor_profile_id = v_actor_id and command_name = 'update_draft' and idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    return v_prior.result_snapshot || jsonb_build_object('replayed', true);
  end if;
  select * into v_row from public.announcements where id = p_announcement_id for update;
  if not found or not private.can_admin_announcement_scope(v_row.scope_type, v_row.branch_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_row.version <> p_expected_version then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_row.version);
  end if;
  if v_row.state <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_row.state, 'current_version', v_row.version);
  end if;
  update public.announcements set scope_type = v_scope_type, branch_id = p_branch_id,
    title = v_title, body = v_body, importance = v_importance,
    updated_at = pg_catalog.now(), updated_by = v_actor_id, version = version + 1
  where id = p_announcement_id;
  v_result := jsonb_build_object('ok', true, 'announcement_id', p_announcement_id, 'state', 'draft',
    'version', v_row.version + 1, 'replayed', false);
  insert into private.announcement_command_receipts
    (actor_profile_id, command_name, idempotency_key, request_snapshot, result_snapshot)
  values (v_actor_id, 'update_draft', v_key, v_request, v_result);
  return v_result;
end;
$$;

create function public.publish_announcement(
  p_announcement_id uuid,
  p_expected_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb;
  v_prior record;
  v_row record;
  v_recipient_count bigint;
  v_published_at timestamptz := pg_catalog.now();
  v_result jsonb;
begin
  if p_announcement_id is null or p_expected_version is null or p_expected_version < 1
    or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  if private.active_announcement_admin_type() is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_request := jsonb_build_object('announcement_id', p_announcement_id, 'expected_version', p_expected_version);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':publish:' || v_key, 0));
  select request_snapshot, result_snapshot into v_prior from private.announcement_command_receipts
  where actor_profile_id = v_actor_id and command_name = 'publish' and idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    return v_prior.result_snapshot || jsonb_build_object('replayed', true);
  end if;
  select * into v_row from public.announcements where id = p_announcement_id for update;
  if not found or not private.can_admin_announcement_scope(v_row.scope_type, v_row.branch_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_row.version <> p_expected_version then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_row.version);
  end if;
  if v_row.state <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_row.state, 'current_version', v_row.version);
  end if;
  if v_row.title = '' or v_row.body = '' then return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); end if;
  insert into public.announcement_recipients (announcement_id, worker_id, recipient_profile_id, created_at)
  select v_row.id, w.id, w.auth_profile_id, v_published_at
  from public.workers as w
  join public.profiles as p on p.id = w.auth_profile_id
  where w.status = 'active' and p.account_type = 'worker' and p.is_active = true
    and (v_row.scope_type = 'organization' or w.branch_id = v_row.branch_id);
  get diagnostics v_recipient_count = row_count;
  if v_recipient_count = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_AUDIENCE';
  end if;
  update public.announcements set state = 'published', published_at = v_published_at,
    published_by = v_actor_id, updated_at = v_published_at, updated_by = v_actor_id,
    version = version + 1 where id = p_announcement_id;
  v_result := jsonb_build_object('ok', true, 'announcement_id', p_announcement_id, 'state', 'published',
    'published_at', v_published_at, 'recipient_count', v_recipient_count, 'version', v_row.version + 1, 'replayed', false);
  insert into private.announcement_command_receipts
    (actor_profile_id, command_name, idempotency_key, request_snapshot, result_snapshot)
  values (v_actor_id, 'publish', v_key, v_request, v_result);
  return v_result;
exception when sqlstate 'P0001' then
  if sqlerrm = 'EMPTY_AUDIENCE' then return jsonb_build_object('ok', false, 'code', 'EMPTY_AUDIENCE'); end if;
  raise;
end;
$$;

create function public.archive_announcement(p_announcement_id uuid, p_expected_version bigint, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor_id uuid := (select auth.uid()); v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb; v_prior record; v_row record; v_at timestamptz := pg_catalog.now(); v_result jsonb;
begin
  if p_announcement_id is null or p_expected_version is null or p_expected_version < 1 or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); end if;
  if private.active_announcement_admin_type() is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_request := jsonb_build_object('announcement_id', p_announcement_id, 'expected_version', p_expected_version);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':archive:' || v_key, 0));
  select request_snapshot, result_snapshot into v_prior from private.announcement_command_receipts
  where actor_profile_id = v_actor_id and command_name = 'archive' and idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    return v_prior.result_snapshot || jsonb_build_object('replayed', true); end if;
  select * into v_row from public.announcements where id = p_announcement_id for update;
  if not found or not private.can_admin_announcement_scope(v_row.scope_type, v_row.branch_id) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  if v_row.version <> p_expected_version then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_row.version); end if;
  if v_row.state <> 'published' then return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_row.state, 'current_version', v_row.version); end if;
  update public.announcements set state = 'archived', archived_at = v_at, archived_by = v_actor_id,
    updated_at = v_at, updated_by = v_actor_id, version = version + 1 where id = p_announcement_id;
  v_result := jsonb_build_object('ok', true, 'announcement_id', p_announcement_id, 'state', 'archived',
    'archived_at', v_at, 'version', v_row.version + 1, 'replayed', false);
  insert into private.announcement_command_receipts (actor_profile_id, command_name, idempotency_key, request_snapshot, result_snapshot)
  values (v_actor_id, 'archive', v_key, v_request, v_result);
  return v_result;
end;
$$;

create function public.delete_announcement_draft(p_announcement_id uuid, p_expected_version bigint, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor_id uuid := (select auth.uid()); v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request jsonb; v_prior record; v_row record; v_result jsonb;
begin
  if p_announcement_id is null or p_expected_version is null or p_expected_version < 1 or v_key = '' or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); end if;
  if private.active_announcement_admin_type() is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_request := jsonb_build_object('announcement_id', p_announcement_id, 'expected_version', p_expected_version);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_id::text || ':delete_draft:' || v_key, 0));
  select request_snapshot, result_snapshot into v_prior from private.announcement_command_receipts
  where actor_profile_id = v_actor_id and command_name = 'delete_draft' and idempotency_key = v_key;
  if found then
    if v_prior.request_snapshot <> v_request then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    return v_prior.result_snapshot || jsonb_build_object('replayed', true); end if;
  select * into v_row from public.announcements where id = p_announcement_id for update;
  if not found or not private.can_admin_announcement_scope(v_row.scope_type, v_row.branch_id) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  if v_row.version <> p_expected_version then return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'current_version', v_row.version); end if;
  if v_row.state <> 'draft' then return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_row.state, 'current_version', v_row.version); end if;
  if v_row.published_at is not null or exists (select 1 from public.announcement_recipients where announcement_id = p_announcement_id) then
    return jsonb_build_object('ok', false, 'code', 'STATE_CONFLICT', 'current_state', v_row.state, 'current_version', v_row.version); end if;
  delete from public.announcements where id = p_announcement_id;
  v_result := jsonb_build_object('ok', true, 'announcement_id', p_announcement_id, 'deleted', true, 'version', p_expected_version, 'replayed', false);
  insert into private.announcement_command_receipts (actor_profile_id, command_name, idempotency_key, request_snapshot, result_snapshot)
  values (v_actor_id, 'delete_draft', v_key, v_request, v_result);
  return v_result;
end;
$$;

create function public.list_admin_announcements(p_limit integer default 50, p_cursor_at timestamptz default null, p_cursor_id uuid default null, p_state text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_limit integer; v_account_type text := private.active_announcement_admin_type();
begin
  if v_account_type is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_state is not null and p_state not in ('draft','published','archived'))
    or ((p_cursor_at is null) <> (p_cursor_id is null)) then return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); end if;
  v_limit := p_limit;
  return jsonb_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('announcement_id', q.id, 'state', q.state, 'version', q.version,
      'scope_type', q.scope_type, 'branch_id', q.branch_id, 'branch_name', q.branch_name,
      'title', q.title, 'body', q.body, 'importance', q.importance,
      'created_at', q.created_at, 'published_at', q.published_at, 'archived_at', q.archived_at,
      'recipient_count', q.recipient_count) order by q.sort_at desc, q.id desc)
    from (
      select a.*, b.name as branch_name, coalesce(a.published_at,a.created_at) as sort_at,
        (select count(*) from public.announcement_recipients ar where ar.announcement_id=a.id) as recipient_count
      from public.announcements a left join public.branches b on b.id=a.branch_id
      where private.can_admin_announcement_scope(a.scope_type,a.branch_id)
        and (p_state is null or a.state=p_state)
        and (p_cursor_at is null or (coalesce(a.published_at,a.created_at),a.id) < (p_cursor_at,p_cursor_id))
      order by sort_at desc,a.id desc limit v_limit
    ) q
  ), '[]'::jsonb));
end;
$$;

create function public.get_admin_announcement(p_announcement_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_announcement_id is null then return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); end if;
  if private.active_announcement_admin_type() is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select jsonb_build_object('ok',true,'announcement',jsonb_build_object('announcement_id',a.id,'state',a.state,'version',a.version,
    'scope_type',a.scope_type,'branch_id',a.branch_id,'branch_name',b.name,'title',a.title,'body',a.body,'importance',a.importance,
    'created_at',a.created_at,'published_at',a.published_at,'archived_at',a.archived_at,
    'recipient_count',(select count(*) from public.announcement_recipients ar where ar.announcement_id=a.id))) into v_result
  from public.announcements a left join public.branches b on b.id=a.branch_id
  where a.id=p_announcement_id and private.can_admin_announcement_scope(a.scope_type,a.branch_id);
  return coalesce(v_result,jsonb_build_object('ok',false,'code','NOT_FOUND'));
end;
$$;

create function public.list_worker_announcements(p_limit integer default 50, p_cursor_published_at timestamptz default null, p_cursor_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 or ((p_cursor_published_at is null) <> (p_cursor_id is null)) then
    return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  if not exists (select 1 from public.profiles p join public.workers w on w.auth_profile_id=p.id and w.status='active'
    where p.id=(select auth.uid()) and p.account_type='worker' and p.is_active=true) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
  return jsonb_build_object('ok',true,'items',coalesce((select jsonb_agg(jsonb_build_object(
    'announcement_id',q.id,'title',q.title,'importance',q.importance,'published_at',q.published_at)
    order by q.published_at desc,q.id desc) from (
      select a.id,a.title,a.importance,a.published_at from public.announcements a
      where private.can_worker_read_announcement(a.id)
        and (p_cursor_published_at is null or (a.published_at,a.id)<(p_cursor_published_at,p_cursor_id))
      order by a.published_at desc,a.id desc limit p_limit
    ) q),'[]'::jsonb));
end;
$$;

create function public.get_worker_announcement(p_announcement_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_announcement_id is null then return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  select jsonb_build_object('ok',true,'announcement',jsonb_build_object('announcement_id',a.id,'title',a.title,
    'body',a.body,'importance',a.importance,'published_at',a.published_at)) into v_result
  from public.announcements a where a.id=p_announcement_id and private.can_worker_read_announcement(a.id);
  return coalesce(v_result,jsonb_build_object('ok',false,'code','NOT_FOUND'));
end;
$$;

revoke all privileges on table public.announcements from public, anon, authenticated;
revoke all privileges on table public.announcement_recipients from public, anon, authenticated;
revoke all privileges on table private.announcement_command_receipts from public, anon, authenticated, service_role;
grant all privileges on table public.announcements to service_role;
grant all privileges on table public.announcement_recipients to service_role;

alter function private.active_announcement_admin_type() owner to postgres;
alter function private.can_admin_announcement_scope(text, uuid) owner to postgres;
alter function private.can_worker_read_announcement(uuid) owner to postgres;
alter function private.enforce_announcement_lifecycle() owner to postgres;
alter function private.enforce_announcement_delete() owner to postgres;
alter function private.enforce_announcement_recipient_immutability() owner to postgres;

revoke all on function private.active_announcement_admin_type() from public, anon, authenticated;
revoke all on function private.can_admin_announcement_scope(text, uuid) from public, anon, authenticated;
revoke all on function private.can_worker_read_announcement(uuid) from public, anon, authenticated;
revoke all on function private.enforce_announcement_lifecycle() from public, anon, authenticated;
revoke all on function private.enforce_announcement_delete() from public, anon, authenticated;
revoke all on function private.enforce_announcement_recipient_immutability() from public, anon, authenticated;
grant execute on function private.active_announcement_admin_type() to authenticated;
grant execute on function private.can_admin_announcement_scope(text, uuid) to authenticated;
grant execute on function private.can_worker_read_announcement(uuid) to authenticated;

alter function public.create_announcement_draft(text, uuid, text, text, text, text) owner to postgres;
alter function public.update_announcement_draft(uuid, bigint, text, uuid, text, text, text, text) owner to postgres;
alter function public.publish_announcement(uuid, bigint, text) owner to postgres;
alter function public.archive_announcement(uuid, bigint, text) owner to postgres;
alter function public.delete_announcement_draft(uuid, bigint, text) owner to postgres;
alter function public.list_admin_announcements(integer, timestamptz, uuid, text) owner to postgres;
alter function public.get_admin_announcement(uuid) owner to postgres;
alter function public.list_worker_announcements(integer, timestamptz, uuid) owner to postgres;
alter function public.get_worker_announcement(uuid) owner to postgres;

revoke all on function public.create_announcement_draft(text, uuid, text, text, text, text) from public, anon;
revoke all on function public.update_announcement_draft(uuid, bigint, text, uuid, text, text, text, text) from public, anon;
revoke all on function public.publish_announcement(uuid, bigint, text) from public, anon;
revoke all on function public.archive_announcement(uuid, bigint, text) from public, anon;
revoke all on function public.delete_announcement_draft(uuid, bigint, text) from public, anon;
revoke all on function public.list_admin_announcements(integer, timestamptz, uuid, text) from public, anon;
revoke all on function public.get_admin_announcement(uuid) from public, anon;
revoke all on function public.list_worker_announcements(integer, timestamptz, uuid) from public, anon;
revoke all on function public.get_worker_announcement(uuid) from public, anon;

grant execute on function public.create_announcement_draft(text, uuid, text, text, text, text) to authenticated;
grant execute on function public.update_announcement_draft(uuid, bigint, text, uuid, text, text, text, text) to authenticated;
grant execute on function public.publish_announcement(uuid, bigint, text) to authenticated;
grant execute on function public.archive_announcement(uuid, bigint, text) to authenticated;
grant execute on function public.delete_announcement_draft(uuid, bigint, text) to authenticated;
grant execute on function public.list_admin_announcements(integer, timestamptz, uuid, text) to authenticated;
grant execute on function public.get_admin_announcement(uuid) to authenticated;
grant execute on function public.list_worker_announcements(integer, timestamptz, uuid) to authenticated;
grant execute on function public.get_worker_announcement(uuid) to authenticated;
