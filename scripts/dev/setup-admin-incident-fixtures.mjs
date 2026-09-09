import { execFileSync } from "node:child_process";
const dockerArgs=["exec","-i","supabase_db_dispatch-os","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At","-q"];
const actors={workerA:"a0000000-0000-0000-0000-000000000001",workerC:"a0000000-0000-0000-0000-000000000003",manager:"a0000000-0000-0000-0000-000000000004"};
const workers={workerA:"c0000000-0000-0000-0000-000000000001",workerC:"c0000000-0000-0000-0000-000000000003"};
const jobs={nagoya:"10000000-0000-0000-0000-000000000001",tokyo:"10000000-0000-0000-0000-000000000003"};
const ids=Object.fromEntries(Array.from({length:5},(_,index)=>{const n=String(index+1).padStart(12,"0");return[`A${index+1}`,{shift:`99000000-0000-4000-8001-${n}`,assignment:`99000000-0000-4000-8002-${n}`}]}));
function run(sql){return execFileSync("docker",dockerArgs,{input:sql,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim()}
function role(profileId,body){return`begin;set local role authenticated;set local request.jwt.claims='{"sub":"${profileId}","role":"authenticated"}';${body}commit;`}
function json(sql){return JSON.parse(run(sql).split(/\r?\n/).at(-1))}
function create(name,actor,category,message,key){return json(role(actor,`select public.create_operational_incident('${ids[name].assignment}'::uuid,'${category}','${message}','${key}')::text;`))}
function transition(command,actor,incident,version,key){return json(role(actor,`select public.${command}_operational_incident('${incident}'::uuid,${version},'${key}')::text;`))}
function cleanup(){run(`begin;delete from public.operational_incident_events where incident_id in(select id from public.operational_incidents where assignment_id::text like '99000000-0000-%');delete from public.operational_incidents where assignment_id::text like '99000000-0000-%';delete from public.assignments where id::text like '99000000-0000-%';delete from public.shift_slots where id::text like '99000000-0000-%';commit;`)}
if(process.argv.includes("--cleanup")){cleanup();console.log("Admin Incident fixtures cleaned.");process.exit(0)}
cleanup();
const parents=Object.entries(ids).map(([name,id],index)=>{const foreign=name==="A5";return`insert into public.shift_slots(id,job_id,starts_at,ends_at,required_workers,status) values('${id.shift}','${foreign?jobs.tokyo:jobs.nagoya}',date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'+interval '${index+8} hours',date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'+interval '${index+16} hours',1,'confirmed');insert into public.assignments(id,shift_slot_id,worker_id,source,status) values('${id.assignment}','${id.shift}','${foreign?workers.workerC:workers.workerA}','manager','confirmed');`}).join("\n");run(`begin;${parents}commit;`);
const acknowledged=create("A2",actors.workerA,"assignment_instruction","担当場所を確認したいです","ui-27e-A2-create");transition("acknowledge",actors.manager,acknowledged.incident_id,acknowledged.version,"ui-27e-A2-ack");
const resolved=create("A3",actors.workerA,"schedule_transport","交通遅延がありました","ui-27e-A3-create");const resolvedAck=transition("acknowledge",actors.manager,resolved.incident_id,resolved.version,"ui-27e-A3-ack");transition("resolve",actors.manager,resolved.incident_id,resolvedAck.version,"ui-27e-A3-resolve");
const retracted=create("A4",actors.workerA,"other","取り下げ確認用","ui-27e-A4-create");transition("retract",actors.workerA,retracted.incident_id,retracted.version,"ui-27e-A4-retract");
create("A5",actors.workerC,"site_access","東京支店のHelp Request","ui-27e-A5-create");
console.log(JSON.stringify({assignments:Object.fromEntries(Object.entries(ids).map(([name,value])=>[name,value.assignment]))}));
