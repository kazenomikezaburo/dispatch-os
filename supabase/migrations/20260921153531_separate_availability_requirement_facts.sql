-- Keep STAFF-2C requirement eligibility outside the Availability reader contract.

alter function public.get_worker_shift_availability_facts(uuid, uuid)
  rename to get_worker_shift_availability_facts_internal;

revoke all on function public.get_worker_shift_availability_facts_internal(uuid, uuid)
  from public, anon, authenticated, service_role;

create function public.get_worker_shift_availability_facts(
  p_worker_id uuid,
  p_shift_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_worker_shift_availability_facts_internal(
    p_worker_id,
    p_shift_id
  ) - 'requirementsEligible';
$$;

alter function public.get_worker_shift_availability_facts_internal(uuid, uuid)
  owner to postgres;
alter function public.get_worker_shift_availability_facts(uuid, uuid)
  owner to postgres;

revoke all on function public.get_worker_shift_availability_facts_internal(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_worker_shift_availability_facts(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_worker_shift_availability_facts(uuid, uuid)
  to authenticated;
