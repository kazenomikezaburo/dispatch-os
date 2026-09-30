create table private.line_runtime_configuration (
  singleton boolean primary key default true,
  internal_command_secret_sha256 text,
  updated_at timestamptz not null default clock_timestamp(),
  constraint line_runtime_configuration_singleton_check check (singleton),
  constraint line_runtime_configuration_hash_check check (
    internal_command_secret_sha256 is null
    or internal_command_secret_sha256 ~ '^[0-9a-f]{64}$'
  )
);

insert into private.line_runtime_configuration(singleton) values (true);
alter table private.line_runtime_configuration enable row level security;
revoke all on table private.line_runtime_configuration from public, anon, authenticated, service_role;

create or replace function private.line_internal_secret_valid(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_secret is not null
    and char_length(p_secret) >= 32
    and c.internal_command_secret_sha256 is not null
    and encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex')
      = c.internal_command_secret_sha256
  from private.line_runtime_configuration as c
  where c.singleton
$$;

alter function private.line_internal_secret_valid(text) owner to postgres;
revoke all on function private.line_internal_secret_valid(text) from public, anon, authenticated, service_role;

comment on table private.line_runtime_configuration is
  'Hash-only trusted LINE route command configuration. Raw internal and provider secrets remain exclusively in server environment storage.';
