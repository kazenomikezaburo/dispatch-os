import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const dockerArgs = ["exec","-i","supabase_db_dispatch-os","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-Atq"];
const adminArgs = ["exec","-i","supabase_db_dispatch-os","psql","-U","supabase_admin","-d","postgres","-v","ON_ERROR_STOP=1","-Atq"];
const workerA = "a0000000-0000-0000-0000-000000000001";
const workerB = "a0000000-0000-0000-0000-000000000002";
const notifications = Array.from({ length: 8 },(_,i)=>`c2060000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
let passed=0;

function sql(statement,admin=false) {
  return execFileSync("docker",admin?adminArgs:dockerArgs,{input:statement,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
}
async function sqlAsync(statement) {
  const {stdout}=await execFileAsync("docker",[...adminArgs,"-c",statement],{encoding:"utf8",maxBuffer:1024*1024});
  return stdout.trim();
}
function pass(name,condition) { assert.ok(condition,name); passed+=1; console.log(`PASS ${name}`); }
function fails(statement,admin=false) { try { sql(statement,admin); return false; } catch { return true; } }
function operator(statement) { return sql(`begin; set local role opscue_line_canary_operator; ${statement}; commit;`,true); }
function claim(scopeId) { return sql(`begin; set local role opscue_line_canary_dispatcher; select count(*) from private.claim_line_delivery_canary('${scopeId}'); commit;`,true); }
function createScope(notification,worker=workerA) {
  return operator(`select private.create_line_delivery_canary_scope('${notification}','${worker}',15)`)
    .split(/\r?\n/).find((line)=>/^[0-9a-f-]{36}$/.test(line));
}
function cleanup() {
  const ids=notifications.map((id)=>`'${id}'`).join(",");
  sql(`
    begin; set local session_replication_role=replica;
    delete from private.line_delivery_canary_scopes where delivery_id in (select id from private.line_notification_deliveries where notification_id in (${ids}));
    alter table private.line_delivery_attempt_results disable trigger reject_line_delivery_attempt_result_mutation;
    delete from private.line_delivery_attempt_results where attempt_start_id in (
      select a.id from private.line_delivery_attempt_starts a join private.line_notification_deliveries d on d.id=a.delivery_id where d.notification_id in (${ids})
    );
    alter table private.line_delivery_attempt_results enable trigger reject_line_delivery_attempt_result_mutation;
    alter table private.line_delivery_attempt_starts disable trigger reject_line_delivery_attempt_start_mutation;
    delete from private.line_delivery_attempt_starts where delivery_id in (select id from private.line_notification_deliveries where notification_id in (${ids}));
    alter table private.line_delivery_attempt_starts enable trigger reject_line_delivery_attempt_start_mutation;
    delete from private.line_notification_deliveries where notification_id in (${ids});
    delete from private.scheduled_worker_reminder_occurrences where notification_id in (${ids});
    delete from public.in_app_notifications where id in (${ids});
    delete from private.worker_line_links where profile_id in ('${workerA}','${workerB}') and line_user_id in ('Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    commit;`,true);
}
function setup() {
  const rows=notifications.map((id,index)=>{
    const worker=index===0?workerB:workerA;
    return `
      v_occurrence:=gen_random_uuid();
      insert into private.scheduled_worker_reminder_occurrences(id,assignment_id,recipient_profile_id,reminder_type,phase,eligible_at,due_at,notification_id,created_at)
      values(v_occurrence,gen_random_uuid(),'${worker}','arrival_reminder','approaching',v_now,v_now,'${id}',v_now+interval '${index} milliseconds');
      insert into public.in_app_notifications(id,recipient_profile_id,notification_type,source_incident_event_id,source_announcement_id,source_pre_confirmation_reminder_id,source_scheduled_worker_reminder_id,title,summary,created_at)
      values('${id}','${worker}','arrival_reminder',null,null,null,v_occurrence,'Canary test','Controlled summary',v_now+interval '${index} milliseconds');`;
  }).join("\n");
  sql(`
    begin;
    insert into private.worker_line_links(profile_id,line_user_id,destination_status,external_reminders_enabled,enabled_at,linked_at,availability_event_at,updated_at) values
      ('${workerA}','Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','linked_available',true,clock_timestamp()-interval '1 minute',clock_timestamp(),clock_timestamp(),clock_timestamp()),
      ('${workerB}','Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','linked_available',true,clock_timestamp()-interval '1 minute',clock_timestamp(),clock_timestamp(),clock_timestamp());
    do $body$ declare v_now timestamptz:=clock_timestamp(); v_occurrence uuid; begin ${rows} end; $body$;
    commit;`);
}

try {
  cleanup(); setup();
  const targetScope=createScope(notifications[1]);
  pass("scope creation returns an opaque UUID",Boolean(targetScope));
  pass("wrong Worker is rejected",fails(`begin; set local role opscue_line_canary_operator; select private.create_line_delivery_canary_scope('${notifications[2]}','${workerB}',15); commit;`,true));
  pass("random UUID claims nothing",claim("ffffffff-ffff-4fff-8fff-ffffffffffff")==="0");

  pass("canary claims exact target while older other-Worker row exists",claim(targetScope)==="1");
  pass("scope outside delivery remains pristine",sql(`select attempt_count from private.line_notification_deliveries where notification_id='${notifications[0]}'`)==="0");
  pass("replayed scope claims nothing",claim(targetScope)==="0");

  const revoked=createScope(notifications[2]);
  pass("operator revokes an unused scope",operator(`select private.revoke_line_delivery_canary_scope('${revoked}')`)==="t");
  pass("revoked scope claims nothing",claim(revoked)==="0");

  const expired=createScope(notifications[3]);
  sql(`update private.line_delivery_canary_scopes set created_at=clock_timestamp()-interval '10 minutes',expires_at=clock_timestamp()-interval '1 second' where id='${expired}'`);
  pass("expired scope claims nothing",claim(expired)==="0");

  sql(`update private.line_notification_deliveries set status='terminal_failure',next_attempt_at=null,finalized_at=clock_timestamp(),status_reason='invalid_request' where notification_id='${notifications[4]}'`);
  pass("terminal delivery cannot receive a scope",fails(`begin; set local role opscue_line_canary_operator; select private.create_line_delivery_canary_scope('${notifications[4]}','${workerA}',15); commit;`,true));

  sql(`select count(*) from private.claim_line_delivery_locked((select id from private.line_notification_deliveries where notification_id='${notifications[5]}'),clock_timestamp())`);
  pass("delivery with an existing attempt cannot receive a scope",fails(`begin; set local role opscue_line_canary_operator; select private.create_line_delivery_canary_scope('${notifications[5]}','${workerA}',15); commit;`,true));

  const concurrent=createScope(notifications[6]);
  const concurrentSql=`begin; set local role opscue_line_canary_dispatcher; select count(*) from private.claim_line_delivery_canary('${concurrent}'); select pg_sleep(1); commit;`;
  const results=await Promise.all([sqlAsync(concurrentSql),sqlAsync(concurrentSql)]);
  pass("two concurrent canary tasks claim exactly once",results.map((value)=>value.split(/\r?\n/)[0]).sort().join(",")==="0,1");
  pass("concurrent claim appends one attempt",sql(`select count(*) from private.line_delivery_attempt_starts a join private.line_notification_deliveries d on d.id=a.delivery_id where d.notification_id='${notifications[6]}'`)==="1");

  pass("canary role has no broad claim EXECUTE",sql("select has_function_privilege('opscue_line_canary_dispatcher','private.claim_line_deliveries(integer)','EXECUTE')")==="f");
  pass("normal role has no canary claim EXECUTE",sql("select has_function_privilege('opscue_line_dispatcher','private.claim_line_delivery_canary(uuid)','EXECUTE')")==="f");
  pass("canary role has no direct table DML",["SELECT","INSERT","UPDATE","DELETE"].every((privilege)=>sql(`select has_table_privilege('opscue_line_canary_dispatcher','private.line_notification_deliveries','${privilege}')`)==="f"));
  pass("canary role cannot mutate delivery table",fails("begin; set local role opscue_line_canary_dispatcher; update private.line_notification_deliveries set updated_at=clock_timestamp(); commit;",true));
} finally { cleanup(); }

pass("dedicated canary fixtures cleaned",sql(`select (select count(*) from public.in_app_notifications where id::text like 'c2060000-0000-4000-8000-%')+(select count(*) from private.line_notification_deliveries where notification_id::text like 'c2060000-0000-4000-8000-%')`)==="0");
console.log(`Worker LINE delivery canary isolation: PASS (${passed} assertions)`);
