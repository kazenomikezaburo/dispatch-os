import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const psql=["exec","-i","supabase_db_dispatch-os","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-Atq"];
const actors={workerA:"a0000000-0000-0000-0000-000000000001",workerC:"a0000000-0000-0000-0000-000000000003",manager:"a0000000-0000-0000-0000-000000000004"};
const workers={a:"c0000000-0000-0000-0000-000000000001",c:"c0000000-0000-0000-0000-000000000003"};
const jobs={own:"10000000-0000-0000-0000-000000000001",foreign:"10000000-0000-0000-0000-000000000003"};
const names=["pre","preBefore","wakeNear","wakeLate","wakeDone","departureNear","departureLate","downstream","arrivalNear","arrivalLate","arrivalStarted","terminal","cancelled","foreign","cooldown","crossMidnight"];
const uuid=(kind,index)=>`b77${kind}0000-0000-0000-0000-${String(index+1).padStart(12,"0")}`;
const shifts=Object.fromEntries(names.map((name,index)=>[name,uuid("1",index)]));
const assignments=Object.fromEntries(names.map((name,index)=>[name,uuid("2",index)]));
const confirmations=Object.fromEntries(names.map((name,index)=>[name,uuid("3",index)]));
const now="2026-09-28T09:00:00Z";
let passed=0;
function sql(statement,allowFailure=false){try{return execFileSync("docker",psql,{input:statement,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}catch(error){if(allowFailure)return `${error.stdout??""}${error.stderr??""}`;throw error;}}
function roleSql(actor,statement,role="authenticated"){return `begin;set local role ${role};set local request.jwt.claims='{"sub":"${actor}","role":"${role}"}';${statement};commit;`;}
function json(statement){const output=sql(statement);const line=output.split(/\r?\n/).find(value=>value.trim().startsWith("{"));return JSON.parse(line);}
function pass(name,value){assert.ok(value,name);passed+=1;console.log(`PASS ${name}`);}
function notificationCount(name,type,phase){return Number(sql(`select count(*) from private.scheduled_worker_reminder_occurrences where assignment_id='${assignments[name]}' and reminder_type='${type}' and phase='${phase}'`));}
function cleanup(){sql(`begin;set constraints all deferred;with removed as(delete from private.scheduled_worker_reminder_occurrences where assignment_id::text like 'b7720000-0000-0000-0000-%' returning notification_id) delete from public.in_app_notifications where id in(select notification_id from removed);delete from public.assignment_journey_event_versions where assignment_id::text like 'b7720000-0000-0000-0000-%';delete from public.attendance_events where assignment_id::text like 'b7720000-0000-0000-0000-%';delete from public.pre_shift_confirmations where assignment_id::text like 'b7720000-0000-0000-0000-%';delete from public.assignments where id::text like 'b7720000-0000-0000-0000-%';delete from public.shift_slots where id::text like 'b7710000-0000-0000-0000-%';commit;`);}
function setup(){cleanup();const shiftValues=names.map(name=>{
  let starts="'2026-09-28T14:00:00Z'",ends="'2026-09-28T22:00:00Z'",meeting="'2026-09-28T13:00:00Z'",status="confirmed";
  if(name==="pre"||name==="preBefore"){starts=name==="pre"?"'2026-09-29T03:00:00Z'":"'2026-09-30T03:00:00Z'";ends=name==="pre"?"'2026-09-29T11:00:00Z'":"'2026-09-30T11:00:00Z'";meeting=starts;}
  if(["wakeNear","wakeLate","wakeDone","departureNear","departureLate","downstream"].includes(name)){starts="'2026-09-28T15:00:00Z'";ends="'2026-09-28T23:00:00Z'";meeting="'2026-09-28T13:00:00Z'";}
  if(name==="arrivalNear")meeting="'2026-09-28T10:00:00Z'";
  if(name==="arrivalLate"||name==="arrivalStarted")meeting="'2026-09-28T08:54:00Z'";
  if(name==="cooldown")meeting="'2026-09-28T09:04:00Z'";
  if(name==="crossMidnight"){starts="'2026-09-28T15:30:00Z'";ends="'2026-09-29T01:30:00Z'";meeting="'2026-09-28T10:00:00Z'";}
  if(name==="cancelled")status="cancelled";
  return `('${shifts[name]}','${name==="foreign"?jobs.foreign:jobs.own}','OCV1-07A ${name}',${starts},${ends},${meeting},1,'${status}')`;
}).join(",");
const assignmentValues=names.map(name=>`('${assignments[name]}','${shifts[name]}','${name==="foreign"?workers.c:workers.a}','manager','${name==="terminal"?"completed":"confirmed"}')`).join(",");
const confirmed=names.filter(name=>!name.startsWith("pre")&&!['terminal','cancelled'].includes(name));
const confirmationValues=confirmed.map(name=>{
  let wake="null",departure="null";
  if(name==="wakeNear")wake="'2026-09-28T10:00:00Z'";
  if(["wakeLate","wakeDone","downstream"].includes(name))wake="'2026-09-28T08:40:00Z'";
  if(name==="departureNear")departure="'2026-09-28T10:00:00Z'";
  if(["departureLate","downstream"].includes(name))departure="'2026-09-28T08:49:00Z'";
  return `('${confirmations[name]}','${assignments[name]}',true,'good',${wake},${departure})`;
}).join(",");
sql(`begin;insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status) values ${shiftValues};insert into public.assignments(id,shift_slot_id,worker_id,source,status) values ${assignmentValues};set local session_replication_role=replica;insert into public.pre_shift_confirmations(id,assignment_id,can_work,health_status,planned_wake_at,planned_departure_at) values ${confirmationValues};set local session_replication_role=origin;insert into public.assignment_journey_event_versions(assignment_id,journey_type,version,operation,occurred_at,timeliness,actor_profile_id,actor_category,idempotency_key,request_snapshot) values('${assignments.wakeDone}','wake',1,'recorded','2026-09-28T08:45:00Z','late','${actors.workerA}','worker','b7790000-0000-0000-0000-000000000001','{}'),('${assignments.downstream}','arrival',1,'recorded','2026-09-28T08:55:00Z','early_or_on_time','${actors.workerA}','worker','b7790000-0000-0000-0000-000000000002','{}');insert into public.attendance_events(assignment_id,event_type,server_received_at,source) values('${assignments.arrivalStarted}','start_work','2026-09-28T08:59:00Z','worker');commit;`);}

try{
  setup();
  const first=json(`select private.evaluate_worker_reminders('${now}',100)::text`);
  pass("bounded scheduler evaluates and projects",first.ok&&first.evaluated===first.projected&&first.projected>0);
  pass("Pre-shift reminder projects inside canonical open window",notificationCount("pre","pre_confirmation_reminder","approaching")===1);
  pass("Pre-shift before threshold does not send",notificationCount("preBefore","pre_confirmation_reminder","approaching")===0);
  pass("Wake approaching reminder projects",notificationCount("wakeNear","wake_reminder","approaching")===1);
  pass("Wake overdue reminder projects",notificationCount("wakeLate","wake_reminder","overdue")===1);
  pass("Departure approaching reminder projects",notificationCount("departureNear","departure_reminder","approaching")===1);
  pass("Departure overdue reminder projects despite missing Wake",notificationCount("departureLate","departure_reminder","overdue")===1);
  pass("Arrival approaching reminder projects",notificationCount("arrivalNear","arrival_reminder","approaching")===1);
  pass("Arrival overdue reminder projects",notificationCount("arrivalLate","arrival_reminder","overdue")===1);
  pass("Recorded journey suppresses future reminder",notificationCount("wakeDone","wake_reminder","overdue")===0);
  pass("Downstream Arrival suppresses Wake and Departure",Number(sql(`select count(*) from private.scheduled_worker_reminder_occurrences where assignment_id='${assignments.downstream}'`))===0);
  pass("start_work suppresses Arrival without synthesizing it",notificationCount("arrivalStarted","arrival_reminder","overdue")===0&&Number(sql(`select count(*) from public.assignment_journey_event_versions where assignment_id='${assignments.arrivalStarted}' and journey_type='arrival'`))===0);
  pass("terminal and cancelled sources are skipped",Number(sql(`select count(*) from private.scheduled_worker_reminder_occurrences where assignment_id in('${assignments.terminal}','${assignments.cancelled}')`))===0);
  pass("cross-midnight Shift is evaluated by instants",notificationCount("crossMidnight","arrival_reminder","approaching")===1);
  const duplicate=json(`select private.evaluate_worker_reminders('${now}',100)::text`);
  pass("duplicate scheduler run is idempotent",duplicate.projected===0);
  pass("cooldown suppresses overdue phase inside 15 minutes",(json(`select private.evaluate_worker_reminders('2026-09-28T09:10:00Z',100)::text`),notificationCount("cooldown","arrival_reminder","overdue")===0));
  json(`select private.evaluate_worker_reminders('2026-09-28T09:16:00Z',100)::text`);
  pass("overdue phase can project after cooldown",notificationCount("cooldown","arrival_reminder","overdue")===1);
  const wakeNotification=sql(`select notification_id from private.scheduled_worker_reminder_occurrences where assignment_id='${assignments.wakeNear}' and reminder_type='wake_reminder'`);
  const own=json(roleSql(actors.workerA,`select public.resolve_worker_journey_reminder_source_context('${wakeNotification}')::text`));
  const foreign=json(roleSql(actors.workerC,`select public.resolve_worker_journey_reminder_source_context('${wakeNotification}')::text`));
  pass("own Worker resolver returns only Assignment identity",own.source_available&&own.assignment_id===assignments.wakeNear&&Object.keys(own).sort().join(",")==="assignment_id,ok,source_available");
  pass("foreign Worker resolver is safely unavailable",foreign.ok&&!foreign.source_available&&foreign.assignment_id===null);
  pass("Worker Notification RLS isolates recipients",Number(sql(roleSql(actors.workerC,`select count(*) from public.in_app_notifications where id='${wakeNotification}'`)).split(/\r?\n/).find(v=>/^\d+$/.test(v)))===0);
  const managerRead=sql(roleSql(actors.manager,`select count(*) from public.in_app_notifications where id='${wakeNotification}'`));
  pass("Manager gains no Worker Notification read privilege",managerRead.split(/\r?\n/).some(v=>v==="0"));
  sql(`insert into public.assignment_journey_event_versions(assignment_id,journey_type,version,operation,occurred_at,timeliness,actor_profile_id,actor_category,idempotency_key,request_snapshot) values('${assignments.wakeNear}','wake',1,'recorded','2026-09-28T09:05:00Z','early_or_on_time','${actors.workerA}','worker','b7790000-0000-0000-0000-000000000003','{}');`);
  json(`select private.evaluate_worker_reminders('2026-09-28T10:20:00Z',100)::text`);
  pass("canonical completion suppresses future phase",notificationCount("wakeNear","wake_reminder","overdue")===0);
  pass("historical Notification remains immutable after resolution",Number(sql(`select count(*) from public.in_app_notifications where id='${wakeNotification}'`))===1);
  const preNotification=sql(`select notification_id from private.scheduled_worker_reminder_occurrences where assignment_id='${assignments.pre}'`);
  const preResolved=json(roleSql(actors.workerA,`select public.resolve_pre_confirmation_reminder_source_context('${preNotification}')::text`));
  pass("existing pre-confirmation resolver supports scheduled occurrence",preResolved.source_available&&preResolved.assignment_id===assignments.pre);
  pass("scheduler and policy functions are private runtime boundaries",sql("select bool_and(not has_function_privilege(role_name,p.oid,'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['public','anon','authenticated','service_role']) role_name where n.nspname='private' and p.proname in('evaluate_worker_reminders','worker_journey_timing_policy')")==="true");
  pass("private occurrence ledger has RLS and no runtime grants",sql("select c.relrowsecurity and bool_and(not has_table_privilege(role_name,c.oid,privilege)) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['public','anon','authenticated','service_role']) role_name cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege where n.nspname='private' and c.relname='scheduled_worker_reminder_occurrences' group by c.relrowsecurity")==="t");
  const anon=sql(roleSql("00000000-0000-0000-0000-000000000000",`select public.resolve_worker_journey_reminder_source_context('${wakeNotification}')`,"anon"),true);
  pass("anon cannot execute journey resolver",/permission denied/i.test(anon));
}finally{cleanup();}
pass("Dedicated OCV1-07A fixtures cleaned",Number(sql("select (select count(*) from public.shift_slots where id::text like 'b7710000-0000-0000-0000-%')+(select count(*) from private.scheduled_worker_reminder_occurrences where assignment_id::text like 'b7720000-0000-0000-0000-%')"))===0);
console.log(`Worker reminder scheduler: PASS (${passed} assertions)`);
