import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const psql=["exec","-i","supabase_db_dispatch-os","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-Atq"];
const shifts=["b7810000-0000-0000-0000-000000000001","b7810000-0000-0000-0000-000000000002"];
const assignments=["b7820000-0000-0000-0000-000000000001","b7820000-0000-0000-0000-000000000002"];
const worker="c0000000-0000-0000-0000-000000000001";
const job="10000000-0000-0000-0000-000000000001";
let passed=0;
let testStartedAt;

function sql(statement,allowFailure=false){try{return execFileSync("docker",psql,{input:statement,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}catch(error){if(allowFailure)return `${error.stdout??""}${error.stderr??""}`;throw error;}}
function json(statement){const line=sql(statement).split(/\r?\n/).find(value=>value.trim().startsWith("{"));return JSON.parse(line);}
function pass(name,value){assert.ok(value,name);passed+=1;console.log(`PASS ${name}`);}
function cleanup(){sql("select cron.unschedule(jobid) from cron.job where jobname='opscue-worker-reminders-v1-qa'",true);sql(`begin;set constraints all deferred;drop trigger if exists ocv1_07b_force_failure on private.scheduled_worker_reminder_occurrences;drop function if exists private.ocv1_07b_force_failure();with removed as(delete from private.scheduled_worker_reminder_occurrences where assignment_id=any(array['${assignments.join("','")}']::uuid[]) returning notification_id) delete from public.in_app_notifications where id in(select notification_id from removed);delete from public.assignments where id=any(array['${assignments.join("','")}']::uuid[]);delete from public.shift_slots where id=any(array['${shifts.join("','")}']::uuid[]);${testStartedAt?`delete from private.worker_reminder_scheduler_runs where invoked_at>='${testStartedAt}'::timestamptz;`:""}commit;`);}
function schedule(){sql("select cron.schedule('opscue-worker-reminders-v1','* * * * *',$schedule$select private.run_worker_reminder_scheduler(100);$schedule$)");}
function setup(index){sql(`begin;insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status) values('${shifts[index]}','${job}','OCV1-07B ${index}',clock_timestamp()+interval '2 hours',clock_timestamp()+interval '10 hours',clock_timestamp()+interval '30 minutes',1,'confirmed');insert into public.assignments(id,shift_slot_id,worker_id,source,status) values('${assignments[index]}','${shifts[index]}','${worker}','manager','confirmed');commit;`);}
function roleSql(role){return `begin;set local role ${role};select private.run_worker_reminder_scheduler(100);rollback;`;}

try {
  cleanup();
  testStartedAt=sql("select clock_timestamp()");

  const cron=sql("select schedule||'|'||active||'|'||command from cron.job where jobname='opscue-worker-reminders-v1'");
  pass("single every-minute cron invokes only the trusted wrapper",cron==="* * * * *|true|select private.run_worker_reminder_scheduler(100);");
  const qaJobId=Number(sql("select cron.schedule('opscue-worker-reminders-v1-qa','1 second',$schedule$select private.run_worker_reminder_scheduler(100);$schedule$)"));
  await new Promise(resolve=>setTimeout(resolve,2500));
  pass("pg_cron executes the trusted wrapper successfully",Number(sql(`select count(*) from cron.job_run_details where jobid=${qaJobId} and status='succeeded'`))>0);
  sql("select cron.unschedule('opscue-worker-reminders-v1-qa')");
  sql("select cron.unschedule('opscue-worker-reminders-v1')");

  const empty=json("select private.run_worker_reminder_scheduler(100)::text");
  pass("empty batch succeeds with zero projections",empty.ok&&empty.outcome==="succeeded"&&empty.projected===0);
  const repeated=json("select private.run_worker_reminder_scheduler(100)::text");
  pass("repeated empty invocation is safe",repeated.ok&&repeated.projected===0);
  const maximum=json("select private.run_worker_reminder_scheduler(500)::text");
  pass("maximum bounded batch is accepted",maximum.ok&&maximum.outcome==="succeeded");
  pass("batch above 500 fails closed",/between 1 and 500/i.test(sql("select private.run_worker_reminder_scheduler(501)",true)));

  const lockProcess=spawn("docker",psql,{stdio:["pipe","ignore","ignore"]});
  lockProcess.stdin.end("select pg_advisory_lock(79160701::bigint);select pg_sleep(3);");
  await new Promise(resolve=>setTimeout(resolve,500));
  const concurrent=json("select private.run_worker_reminder_scheduler(100)::text");
  pass("concurrent invocation is skipped safely",concurrent.ok&&concurrent.outcome==="skipped_concurrent");
  await new Promise((resolve,reject)=>{lockProcess.on("exit",code=>code===0?resolve():reject(new Error(`lock process exited ${code}`)));});

  setup(0);
  const projected=json("select private.run_worker_reminder_scheduler(100)::text");
  pass("trusted invocation creates the canonical Notification",projected.ok&&projected.projected===1&&Number(sql(`select count(*) from public.in_app_notifications where source_scheduled_worker_reminder_id in(select id from private.scheduled_worker_reminder_occurrences where assignment_id='${assignments[0]}')`))===1);
  const duplicate=json("select private.run_worker_reminder_scheduler(100)::text");
  pass("repeat invocation preserves duplicate suppression",duplicate.ok&&duplicate.projected===0&&Number(sql(`select count(*) from private.scheduled_worker_reminder_occurrences where assignment_id='${assignments[0]}'`))===1);

  setup(1);
  sql(`create function private.ocv1_07b_force_failure() returns trigger language plpgsql set search_path='' as $$begin if new.assignment_id='${assignments[1]}' then raise exception using errcode='P0002',message='forced local QA failure';end if;return new;end;$$;create trigger ocv1_07b_force_failure before insert on private.scheduled_worker_reminder_occurrences for each row execute function private.ocv1_07b_force_failure();`);
  const failed=json("select private.run_worker_reminder_scheduler(100)::text");
  pass("evaluator failure returns a controlled scheduler result",failed.ok===false&&failed.outcome==="failed"&&failed.code==="EVALUATION_FAILED");
  pass("failure evidence stores only a SQLSTATE",sql(`select outcome||'|'||failure_sqlstate||'|'||(evaluated is null)::text||'|'||(projected is null)::text from private.worker_reminder_scheduler_runs where id='${failed.run_id}'`)==="failed|P0002|true|true");
  pass("failed evaluation rolls back partial Notification writes",Number(sql(`select count(*) from private.scheduled_worker_reminder_occurrences where assignment_id='${assignments[1]}'`))===0);
  sql("drop trigger ocv1_07b_force_failure on private.scheduled_worker_reminder_occurrences;drop function private.ocv1_07b_force_failure()");
  const retry=json("select private.run_worker_reminder_scheduler(100)::text");
  pass("retry after evaluator failure succeeds",retry.ok&&retry.projected===1);

  pass("run evidence contains no Worker or Assignment payload columns",sql("select count(*) from information_schema.columns where table_schema='private' and table_name='worker_reminder_scheduler_runs' and column_name in('worker_id','assignment_id','branch_id','payload','error_message')")==="0");
  pass("runtime roles cannot invoke the wrapper",sql("select bool_and(not has_function_privilege(role_name,'private.run_worker_reminder_scheduler(integer)','EXECUTE')) from unnest(array['public','anon','authenticated','service_role']) role_name")==="t");
  pass("anon invocation is denied",/permission denied/i.test(sql(roleSql("anon"),true)));
  pass("authenticated browser role invocation is denied",/permission denied/i.test(sql(roleSql("authenticated"),true)));
  pass("run ledger has RLS and no runtime DML grants",sql("select c.relrowsecurity and bool_and(not has_table_privilege(role_name,c.oid,privilege)) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['public','anon','authenticated','service_role']) role_name cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege where n.nspname='private' and c.relname='worker_reminder_scheduler_runs' group by c.relrowsecurity")==="t");

  const productSources=["app","components","lib"].flatMap(root=>[root]);
  let tracked="";
  try { tracked=execFileSync("git",["grep","-n","-E","run_worker_reminder_scheduler|evaluate_worker_reminders|SERVICE_ROLE_KEY|CRON_SECRET","--",...productSources],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}); }
  catch(error){if(error.status!==1)throw error;}
  pass("browser and product server bundles expose no scheduler or scheduler secret",tracked.trim()==="");
  const migration=readFileSync(new URL("../../supabase/migrations/20260928095623_ocv1_trusted_reminder_scheduler.sql",import.meta.url),"utf8");
  pass("cron command calls the wrapper rather than reimplementing eligibility",/select private\.run_worker_reminder_scheduler\(100\)/.test(migration)&&!/planned_wake_at|planned_departure_at|meeting_at|pre_shift_confirmations/.test(migration));
} finally {
  cleanup();
  schedule();
}

pass("dedicated OCV1-07B fixtures and manual run evidence are cleaned",Number(sql(`select (select count(*) from public.shift_slots where id=any(array['${shifts.join("','")}']::uuid[]))+(select count(*) from private.worker_reminder_scheduler_runs where invoked_at>='${testStartedAt}'::timestamptz)`))===0);
pass("production-style cron remains active after QA",sql("select active::text from cron.job where jobname='opscue-worker-reminders-v1'")==="true");
console.log(`Worker reminder scheduler invocation: PASS (${passed} assertions)`);
