create function test_rls.set_actor(actor_name text, user_id uuid default null)
returns void
language plpgsql
as $$
begin
  perform set_config('test_rls.actor', actor_name, false);
  perform set_config(
    'request.jwt.claims',
    case
      when user_id is null then json_build_object('role', 'anon')::text
      else json_build_object('sub', user_id, 'role', 'authenticated')::text
    end,
    false
  );
end;
$$;

create function test_rls.record_result(
  test_id text,
  category text,
  action text,
  target text,
  expected text,
  actual text,
  passed boolean
)
returns text
language plpgsql
as $$
begin
  insert into test_rls.results (
    test_id, category, actor, action, target, expected, actual, passed
  ) values (
    test_id,
    category,
    current_setting('test_rls.actor', true),
    action,
    target,
    expected,
    actual,
    passed
  );
  return test_id || ': ' || case when passed then 'PASS' else 'FAIL' end;
end;
$$;

create function test_rls.assert_count(
  test_id text,
  category text,
  query_sql text,
  expected_count bigint,
  target text
)
returns text
language plpgsql
as $$
declare
  actual_count bigint;
begin
  execute format('select count(*) from (%s) test_query', query_sql)
    into actual_count;
  return test_rls.record_result(
    test_id, category, 'SELECT', target,
    expected_count::text || ' row(s)', actual_count::text || ' row(s)',
    actual_count = expected_count
  );
exception when others then
  return test_rls.record_result(
    test_id, category, 'SELECT', target,
    expected_count::text || ' row(s)', sqlstate || ': ' || sqlerrm, false
  );
end;
$$;

create function test_rls.assert_value(
  test_id text,
  category text,
  query_sql text,
  expected_value text,
  target text
)
returns text
language plpgsql
as $$
declare
  actual_value text;
begin
  execute format('select (%s)::text', query_sql) into actual_value;
  return test_rls.record_result(
    test_id, category, 'EXECUTE', target,
    coalesce(expected_value, 'NULL'), coalesce(actual_value, 'NULL'),
    actual_value is not distinct from expected_value
  );
exception when others then
  return test_rls.record_result(
    test_id, category, 'EXECUTE', target,
    coalesce(expected_value, 'NULL'), sqlstate || ': ' || sqlerrm, false
  );
end;
$$;

create function test_rls.assert_allowed(
  test_id text,
  category text,
  command_sql text,
  action text,
  target text
)
returns text
language plpgsql
as $$
declare
  affected bigint := 0;
  did_run boolean := false;
  detail text := '';
begin
  begin
    execute command_sql;
    get diagnostics affected = row_count;
    did_run := affected > 0;
    detail := affected::text || ' row(s) affected';
    raise exception using errcode = 'ZX001', message = 'test rollback';
  exception
    when sqlstate 'ZX001' then null;
    when others then
      did_run := false;
      detail := sqlstate || ': ' || sqlerrm;
  end;

  return test_rls.record_result(
    test_id, category, action, target, 'ALLOW', detail, did_run
  );
end;
$$;

create function test_rls.assert_denied(
  test_id text,
  category text,
  command_sql text,
  action text,
  target text
)
returns text
language plpgsql
as $$
declare
  affected bigint := 0;
  was_denied boolean := false;
  detail text := '';
begin
  begin
    execute command_sql;
    get diagnostics affected = row_count;
    was_denied := affected = 0;
    detail := affected::text || ' row(s) affected';
    raise exception using errcode = 'ZX001', message = 'test rollback';
  exception
    when sqlstate 'ZX001' then null;
    when insufficient_privilege then
      was_denied := true;
      detail := sqlstate || ': ' || sqlerrm;
    when others then
      was_denied := false;
      detail := 'unexpected ' || sqlstate || ': ' || sqlerrm;
  end;

  return test_rls.record_result(
    test_id, category, action, target, 'DENY', detail, was_denied
  );
end;
$$;

grant execute on all functions in schema test_rls to authenticated, anon;
