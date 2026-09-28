import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const psql=["exec","-i","supabase_db_dispatch-os","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-Atq"];
const actor={workerA:"a0000000-0000-0000-0000-000000000001",workerC:"a0000000-0000-0000-0000-000000000003",manager:"a0000000-0000-0000-0000-000000000004",admin:"a0000000-0000-0000-0000-000000000005"};
const worker={a:"c0000000-0000-0000-0000-000000000001",c:"c0000000-0000-0000-0000-000000000003"};
const job={own:"10000000-0000-0000-0000-000000000001",foreign:"10000000-0000-0000-0000-000000000003"};
const shift={own:"b6610000-0000-0000-0000-000000000001",foreign:"b6610000-0000-0000-0000-000000000002"};
const assignment={own:"b6620000-0000-0000-0000-000000000001",foreign:"b6620000-0000-0000-0000-000000000002"};
let passed=0;

function sql(statement,allowFailure=false){try{return execFileSync("docker",psql,{input:statement,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}catch(error){if(allowFailure)return `${error.stdout??""}${error.stderr??""}`;throw error;}}
function roleSql(profileId,statement,role="authenticated"){return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; ${statement}; commit;`;}
function rows(profileId,role="authenticated"){const output=sql(roleSql(profileId,"select coalesce(json_agg(f order by f.shift_id),'[]'::json)::text from public.get_admin_assignment_journey_facts(clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day',500) f",role));return JSON.parse(output.slice(output.indexOf("["),output.lastIndexOf("]")+1));}
function pass(name,condition){assert.ok(condition,name);passed+=1;console.log(`PASS ${name}`);}
function cleanup(){sql(`begin;delete from public.assignment_journey_event_versions where assignment_id in ('${assignment.own}','${assignment.foreign}');delete from public.attendance_events where assignment_id in ('${assignment.own}','${assignment.foreign}');delete from public.pre_shift_confirmations where assignment_id in ('${assignment.own}','${assignment.foreign}');delete from public.assignments where id in ('${assignment.own}','${assignment.foreign}');delete from public.shift_slots where id in ('${shift.own}','${shift.foreign}');commit;`);}
function setup(){cleanup();sql(`begin;
insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status) values
('${shift.own}','${job.own}','OCV1-06 own',clock_timestamp()+interval '2 hours',clock_timestamp()+interval '10 hours',clock_timestamp()-interval '10 minutes',1,'confirmed'),
('${shift.foreign}','${job.foreign}','OCV1-06 foreign',clock_timestamp()+interval '2 hours',clock_timestamp()+interval '10 hours',clock_timestamp()-interval '10 minutes',1,'confirmed');
insert into public.assignments(id,shift_slot_id,worker_id,source,status) values
('${assignment.own}','${shift.own}','${worker.a}','manager','confirmed'),('${assignment.foreign}','${shift.foreign}','${worker.c}','manager','confirmed');
set local session_replication_role=replica;
insert into public.pre_shift_confirmations(id,assignment_id,can_work,health_status,planned_wake_at,planned_departure_at) values
('b6630000-0000-0000-0000-000000000001','${assignment.own}',true,'good',clock_timestamp()-interval '30 minutes',clock_timestamp()-interval '20 minutes'),
('b6630000-0000-0000-0000-000000000002','${assignment.foreign}',true,'good',clock_timestamp()-interval '30 minutes',clock_timestamp()-interval '20 minutes');
set local session_replication_role=origin;commit;`);}

try{
  setup();
  const managerRows=rows(actor.manager);
  pass("Manager reads own Branch journey facts",managerRows.some(r=>r.assignment_id===assignment.own));
  pass("Manager cannot read foreign Branch journey facts",!managerRows.some(r=>r.assignment_id===assignment.foreign));
  const adminRows=rows(actor.admin);
  pass("System Admin reads organization scope",adminRows.some(r=>r.assignment_id===assignment.own)&&adminRows.some(r=>r.assignment_id===assignment.foreign));
  pass("Projection includes only current canonical facts",managerRows[0].wake_operation===null&&managerRows[0].departure_operation===null&&managerRows[0].arrival_operation===null);
  pass("Projection exposes no raw history or authorization internals",!["idempotency_key","request_snapshot","correction_reason","actor_profile_id","branch_id"].some(key=>key in managerRows[0]));
  pass("Worker receives no Admin projection rows",rows(actor.workerA).length===0);
  const anon=sql(roleSql("00000000-0000-0000-0000-000000000000","select count(*) from public.get_admin_assignment_journey_facts(now()-interval '1 day',now()+interval '1 day',500)","anon"),true);
  pass("anon cannot execute Admin journey projection",/permission denied/i.test(anon));
  const service=sql(roleSql(actor.admin,"select count(*) from public.get_admin_assignment_journey_facts(now()-interval '1 day',now()+interval '1 day',500)","service_role"),true);
  pass("service_role has no product projection grant",/permission denied/i.test(service));
  const record=JSON.parse(sql(roleSql(actor.workerA,`select public.record_own_assignment_journey_event('${assignment.own}','wake','b6690000-0000-0000-0000-000000000001')::text`)).split(/\r?\n/).at(-1));
  pass("Canonical Worker command records the source fact",record.ok===true);
  pass("Projection self-heals from the canonical latest version",rows(actor.manager).find(r=>r.assignment_id===assignment.own)?.wake_operation==="recorded");
  pass("Journey action did not create Attendance",sql(`select count(*) from public.attendance_events where assignment_id='${assignment.own}'`)==="0");
  pass("Reader is hardened and bounded",sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_admin_assignment_journey_facts' and p.prosecdef and p.proconfig @> array['search_path=\"\"']") === "1");
}finally{cleanup();}
pass("Dedicated OCV1-06 DB fixtures cleaned",sql(`select (select count(*) from public.shift_slots where id in ('${shift.own}','${shift.foreign}'))+(select count(*) from public.assignments where id in ('${assignment.own}','${assignment.foreign}'))`) === "0");
console.log(`Admin journey Attention DB: PASS (${passed} assertions)`);
