create extension if not exists pg_cron with schema pg_catalog;

create table private.worker_reminder_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  invoked_at timestamptz not null,
  completed_at timestamptz not null,
  outcome text not null,
  evaluated integer,
  projected integer,
  failure_sqlstate text,
  constraint worker_reminder_scheduler_runs_outcome_check
    check (outcome in ('succeeded','failed','skipped_concurrent')),
  constraint worker_reminder_scheduler_runs_counts_check
    check (
      (outcome='succeeded' and evaluated is not null and evaluated>=0 and projected is not null and projected>=0 and failure_sqlstate is null)
      or (outcome='failed' and evaluated is null and projected is null and failure_sqlstate ~ '^[0-9A-Z]{5}$')
      or (outcome='skipped_concurrent' and evaluated is null and projected is null and failure_sqlstate is null)
    ),
  constraint worker_reminder_scheduler_runs_time_check check (completed_at>=invoked_at)
);

alter table private.worker_reminder_scheduler_runs enable row level security;
revoke all privileges on table private.worker_reminder_scheduler_runs from public,anon,authenticated,service_role;

create index worker_reminder_scheduler_runs_invoked_idx
  on private.worker_reminder_scheduler_runs(invoked_at desc);

create function private.run_worker_reminder_scheduler(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '45s'
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_invoked_at timestamptz := clock_timestamp();
  v_result jsonb;
  v_sqlstate text;
begin
  if p_limit is null or p_limit<1 or p_limit>500 then
    raise exception using errcode='22023',message='scheduler batch limit must be between 1 and 500';
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(79160701::bigint) then
    insert into private.worker_reminder_scheduler_runs(
      id,invoked_at,completed_at,outcome,evaluated,projected,failure_sqlstate
    ) values (
      v_run_id,v_invoked_at,clock_timestamp(),'skipped_concurrent',null,null,null
    );
    return jsonb_build_object(
      'ok',true,'run_id',v_run_id,'outcome','skipped_concurrent','evaluated',0,'projected',0
    );
  end if;

  begin
    v_result := private.evaluate_worker_reminders(clock_timestamp(),p_limit);

    if coalesce((v_result->>'ok')::boolean,false) is not true then
      raise exception using errcode='P0001',message='canonical reminder evaluator returned a non-success result';
    end if;

    insert into private.worker_reminder_scheduler_runs(
      id,invoked_at,completed_at,outcome,evaluated,projected,failure_sqlstate
    ) values (
      v_run_id,
      v_invoked_at,
      clock_timestamp(),
      'succeeded',
      (v_result->>'evaluated')::integer,
      (v_result->>'projected')::integer,
      null
    );

    return jsonb_build_object(
      'ok',true,
      'run_id',v_run_id,
      'outcome','succeeded',
      'evaluated',(v_result->>'evaluated')::integer,
      'projected',(v_result->>'projected')::integer
    );
  exception when others then
    get stacked diagnostics v_sqlstate=returned_sqlstate;
    insert into private.worker_reminder_scheduler_runs(
      id,invoked_at,completed_at,outcome,evaluated,projected,failure_sqlstate
    ) values (
      v_run_id,v_invoked_at,clock_timestamp(),'failed',null,null,v_sqlstate
    );
    return jsonb_build_object(
      'ok',false,'run_id',v_run_id,'outcome','failed','code','EVALUATION_FAILED'
    );
  end;
end;
$$;

comment on table private.worker_reminder_scheduler_runs is
  'Minimal non-Worker-sensitive execution evidence for the OCV1 reminder scheduler.';
comment on function private.run_worker_reminder_scheduler(integer) is
  'Trusted cron-only wrapper for the canonical bounded reminder evaluator.';

alter table private.worker_reminder_scheduler_runs owner to postgres;
alter function private.run_worker_reminder_scheduler(integer) owner to postgres;
revoke all on function private.run_worker_reminder_scheduler(integer) from public,anon,authenticated,service_role;

select cron.schedule(
  'opscue-worker-reminders-v1',
  '* * * * *',
  $schedule$select private.run_worker_reminder_scheduler(100);$schedule$
);
