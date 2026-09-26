-- OCV1-02B QA: keep the bounded page deterministic after shaping.
do $$
declare
  v_definition text;
  v_old text := 'from (select * from rendered limit v_limit) r;';
  v_new text := 'from (select * from rendered order by starts_at, id limit v_limit) r;';
begin
  select pg_get_functiondef(
    'public.get_own_recruitment_shifts(integer,integer,uuid)'::regprocedure
  ) into v_definition;

  if position(v_old in v_definition) = 0 then
    raise exception 'OCV1 recruitment projection definition did not match the expected pagination source';
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$$;
