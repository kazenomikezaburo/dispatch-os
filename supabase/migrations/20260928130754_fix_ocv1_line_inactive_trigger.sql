create or replace function private.suspend_line_link_for_inactive_worker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    if (to_jsonb(new)->>'is_active')::boolean is distinct from true
       or to_jsonb(new)->>'account_type' <> 'worker' then
      update private.worker_line_links
      set destination_status = 'suspended', external_reminders_enabled = false,
          enabled_at = null, updated_at = clock_timestamp()
      where profile_id = (to_jsonb(new)->>'id')::uuid;
    end if;
  elsif tg_table_name = 'workers' then
    if to_jsonb(new)->>'status' <> 'active' and to_jsonb(new)->>'auth_profile_id' is not null then
      update private.worker_line_links
      set destination_status = 'suspended', external_reminders_enabled = false,
          enabled_at = null, updated_at = clock_timestamp()
      where profile_id = (to_jsonb(new)->>'auth_profile_id')::uuid;
    end if;
  end if;
  return new;
end;
$$;

alter function private.suspend_line_link_for_inactive_worker() owner to postgres;
revoke all on function private.suspend_line_link_for_inactive_worker() from public, anon, authenticated, service_role;
