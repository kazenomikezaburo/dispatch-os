import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const localUrl=process.env.SUPABASE_URL??"http://127.0.0.1:54321";
const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!localUrl.startsWith("http://127.0.0.1:")&&!localUrl.startsWith("http://localhost:"))throw new Error(`Refusing non-local Supabase URL: ${localUrl}`);
if(!serviceRoleKey)throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
const users={manager:{email:"ocv1-06-browser-manager@test.invalid",password:"OCV1-06-Manager-Local-QA!"},worker:{email:"ocv1-06-browser-worker@test.invalid",password:"OCV1-06-Worker-Local-QA!"}};
const ids={worker:"b6b40000-0000-0000-0000-000000000001",shift:"b6b10000-0000-0000-0000-000000000001",assignment:"b6b20000-0000-0000-0000-000000000001",confirmation:"b6b30000-0000-0000-0000-000000000001"};
const psql=["exec","-i","supabase_db_dispatch-os","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-Atq"];
const sql=(statement)=>execFileSync("docker",psql,{input:statement,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
const admin=createClient(localUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});

async function authUsers(){const found=[];for(let page=1;page<=10;page+=1){const{data,error}=await admin.auth.admin.listUsers({page,perPage:100});if(error)throw error;found.push(...data.users.filter(user=>Object.values(users).some(item=>item.email===user.email)));if(data.users.length<100)break;}return found;}
function cleanupDomain(){return Number(sql(`with j as(delete from public.assignment_journey_event_versions where assignment_id='${ids.assignment}' returning 1),e as(delete from public.attendance_events where assignment_id='${ids.assignment}' returning 1),r as(delete from public.attendance_records where assignment_id='${ids.assignment}' returning 1),p as(delete from public.pre_shift_confirmations where assignment_id='${ids.assignment}' returning 1),a as(delete from public.assignments where id='${ids.assignment}' returning 1),s as(delete from public.shift_slots where id='${ids.shift}' returning 1),w as(delete from public.workers where id='${ids.worker}' returning 1) select (select count(*) from j)+(select count(*) from e)+(select count(*) from r)+(select count(*) from p)+(select count(*) from a)+(select count(*) from s)+(select count(*) from w);`)||"0");}
async function cleanup(){const removedRows=cleanupDomain();const existing=await authUsers();for(const user of existing){sql(`delete from public.profiles where id='${user.id}'::uuid;`);const{error}=await admin.auth.admin.deleteUser(user.id);if(error)throw error;}const remainder=Number(sql(`select (select count(*) from public.workers where id='${ids.worker}')+(select count(*) from public.shift_slots where id='${ids.shift}')+(select count(*) from public.assignments where id='${ids.assignment}')+(select count(*) from auth.users where email in ('${users.manager.email}','${users.worker.email}'));`)||"0");return{removedRows,removedAuthUsers:existing.length,remainder};}
async function setup(){await cleanup();const created={};for(const[name,fixture]of Object.entries(users)){const{data,error}=await admin.auth.admin.createUser({email:fixture.email,password:fixture.password,email_confirm:true});if(error||!data.user)throw new Error(`Auth create failed: ${name}: ${error?.message??"no user"}`);created[name]=data.user.id;}try{sql(`begin;
insert into public.profiles(id,display_name,account_type,is_active) values('${created.manager}','OCV1-06 Browser Manager','manager',true),('${created.worker}','OCV1-06 Browser Worker','worker',true);
insert into public.manager_branch_access(profile_id,branch_id,role) values('${created.manager}','b0000000-0000-0000-0000-000000000001','manager');
insert into public.workers(id,staff_code,branch_id,auth_profile_id,display_name,status) values('${ids.worker}','OCV106BROWSER','b0000000-0000-0000-0000-000000000001','${created.worker}','OCV1-06 Browser Worker','active');
insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status) values('${ids.shift}','10000000-0000-0000-0000-000000000001','OCV1-06 browser attention',clock_timestamp()+interval '2 hours',clock_timestamp()+interval '10 hours',clock_timestamp()-interval '10 minutes',1,'confirmed');
insert into public.assignments(id,shift_slot_id,worker_id,source,status) values('${ids.assignment}','${ids.shift}','${ids.worker}','manager','confirmed');
set local session_replication_role=replica;
insert into public.pre_shift_confirmations(id,assignment_id,can_work,health_status,planned_wake_at,planned_departure_at) values('${ids.confirmation}','${ids.assignment}',true,'good',clock_timestamp()-interval '30 minutes',clock_timestamp()-interval '20 minutes');
set local session_replication_role=origin;commit;`);}catch(error){await cleanup();throw error;}return{manager:users.manager,worker:users.worker,assignmentId:ids.assignment,shiftId:ids.shift};}
const mode=process.argv[2]??"setup";
console.log(JSON.stringify(mode==="setup"?await setup():mode==="cleanup"?await cleanup():(()=>{throw new Error(`Unknown mode: ${mode}`)})()));
