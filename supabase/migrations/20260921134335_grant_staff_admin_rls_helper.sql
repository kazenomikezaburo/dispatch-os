-- RLS policies need to evaluate the actor-only active Admin predicate.

revoke all on function private.is_active_admin()
  from public, anon, authenticated, service_role;
grant execute on function private.is_active_admin()
  to authenticated;
