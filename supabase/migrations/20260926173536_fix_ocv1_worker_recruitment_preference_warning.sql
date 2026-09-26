-- OCV1-02B QA: preserve canonical preference mismatch as a nonblocking warning.
-- The immediately preceding migration owns the full projection definition; this
-- follow-up changes only the two presentation branches and fails closed if that
-- exact definition is not present.

do $$
declare
  v_definition text;
  v_updated text;
  v_old_state constant text := $old$when s.availability->>'availabilityState' in ('unknown','partially_available','consultation_required') then 'available_with_warning'$old$;
  v_new_state constant text := $new$when s.availability->>'availabilityState' in ('unknown','partially_available','consultation_required')
          or s.availability->'preferenceMatches'->>'preferredSchedule' in ('partially_matched','not_matched') then 'available_with_warning'$new$;
  v_old_reason constant text := $old$when availability->>'availabilityState' in ('unknown','partially_available','consultation_required') then jsonb_build_array('availability_needs_confirmation') else '[]'::jsonb end$old$;
  v_new_reason constant text := $new$when availability->>'availabilityState' in ('unknown','partially_available','consultation_required') then jsonb_build_array('availability_needs_confirmation') when availability->'preferenceMatches'->>'preferredSchedule' in ('partially_matched','not_matched') then jsonb_build_array('preference_not_matched') else '[]'::jsonb end$new$;
begin
  select pg_get_functiondef('public.get_own_recruitment_shifts(integer,integer,uuid)'::regprocedure)
  into v_definition;

  if strpos(v_definition, v_old_state) = 0 or strpos(v_definition, v_old_reason) = 0 then
    raise exception 'OCV1_RECRUITMENT_PROJECTION_DEFINITION_MISMATCH';
  end if;

  v_updated := replace(replace(v_definition, v_old_state, v_new_state), v_old_reason, v_new_reason);
  execute v_updated;
end;
$$;

alter function public.get_own_recruitment_shifts(integer, integer, uuid) owner to postgres;
revoke all on function public.get_own_recruitment_shifts(integer, integer, uuid) from public, anon, service_role;
grant execute on function public.get_own_recruitment_shifts(integer, integer, uuid) to authenticated;
