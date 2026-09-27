import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const localUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!localUrl.startsWith("http://127.0.0.1:") && !localUrl.startsWith("http://localhost:")) throw new Error(`Refusing non-local Supabase URL: ${localUrl}`);
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

const email = "ocv1-05-browser-worker@test.invalid";
const password = "OCV1-05-Local-QA-Only!";
const ids = {
  worker: "b2b40000-0000-0000-0000-000000000001",
  shifts: ["b2b10000-0000-0000-0000-000000000001", "b2b10000-0000-0000-0000-000000000002"],
  assignments: ["b2b20000-0000-0000-0000-000000000001", "b2b20000-0000-0000-0000-000000000002"],
  confirmation: "b2b30000-0000-0000-0000-000000000002",
};
const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const sql = (statement) => execFileSync("docker", psql, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const admin = createClient(localUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

function cleanupDomainRows() {
  return sql(`with
    j as (delete from public.assignment_journey_event_versions where assignment_id = any(array[${ids.assignments.map((id) => `'${id}'::uuid`).join(",")}]) returning 1),
    e as (delete from public.attendance_events where assignment_id = any(array[${ids.assignments.map((id) => `'${id}'::uuid`).join(",")}]) returning 1),
    r as (delete from public.attendance_records where assignment_id = any(array[${ids.assignments.map((id) => `'${id}'::uuid`).join(",")}]) returning 1),
    p as (delete from public.pre_shift_confirmations where assignment_id = any(array[${ids.assignments.map((id) => `'${id}'::uuid`).join(",")}]) returning 1),
    a as (delete from public.assignments where id = any(array[${ids.assignments.map((id) => `'${id}'::uuid`).join(",")}]) returning 1),
    s as (delete from public.shift_slots where id = any(array[${ids.shifts.map((id) => `'${id}'::uuid`).join(",")}]) returning 1),
    w as (delete from public.workers where id = '${ids.worker}'::uuid returning 1)
    select (select count(*) from j) + (select count(*) from e) + (select count(*) from r) +
      (select count(*) from p) + (select count(*) from a) + (select count(*) from s) + (select count(*) from w);`);
}

async function findAuthUser() {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error("Dedicated QA Auth lookup exceeded the bounded page limit.");
}

async function cleanup() {
  const removedRows = Number(cleanupDomainRows() || "0");
  const user = await findAuthUser();
  if (user) {
    sql(`delete from public.profiles where id = '${user.id}'::uuid;`);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
  const remainder = Number(sql(`select
    (select count(*) from public.workers where id = '${ids.worker}'::uuid) +
    (select count(*) from public.shift_slots where id = any(array[${ids.shifts.map((id) => `'${id}'::uuid`).join(",")}])) +
    (select count(*) from public.assignments where id = any(array[${ids.assignments.map((id) => `'${id}'::uuid`).join(",")}])) +
    (select count(*) from auth.users where email = '${email}');`) || "0");
  return { removedRows, removedAuthUser: Boolean(user), remainder };
}

async function setup() {
  await cleanup();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Dedicated QA Auth creation failed: ${error?.message ?? "no user"}`);
  try {
    sql(`begin;
      insert into public.profiles(id,display_name,account_type,is_active) values ('${data.user.id}','OCV1-05 Browser Worker','worker',true);
      insert into public.workers(id,staff_code,branch_id,auth_profile_id,display_name,status)
      values ('${ids.worker}','OCV105BROWSER','b0000000-0000-0000-0000-000000000001','${data.user.id}','OCV1-05 Browser Worker','active');
      insert into public.shift_slots(id,job_id,label,starts_at,ends_at,meeting_at,required_workers,status) values
        ('${ids.shifts[0]}','10000000-0000-0000-0000-000000000001','OCV1-05 browser flow',clock_timestamp()+interval '3 hours',clock_timestamp()+interval '11 hours',clock_timestamp()+interval '2 hours',1,'confirmed'),
        ('${ids.shifts[1]}','10000000-0000-0000-0000-000000000001','OCV1-05 browser controlled error',clock_timestamp()+interval '4 hours',clock_timestamp()+interval '12 hours',clock_timestamp()+interval '3 hours',1,'confirmed');
      insert into public.assignments(id,shift_slot_id,worker_id,source,status) values
        ('${ids.assignments[0]}','${ids.shifts[0]}','${ids.worker}','manager','confirmed'),
        ('${ids.assignments[1]}','${ids.shifts[1]}','${ids.worker}','manager','confirmed');
      insert into public.pre_shift_confirmations(id,assignment_id,can_work,health_status,planned_wake_at,planned_departure_at)
      values('${ids.confirmation}','${ids.assignments[1]}',true,'good',clock_timestamp()+interval '15 minutes',clock_timestamp()+interval '60 minutes');
    commit;`);
  } catch (setupError) {
    await cleanup();
    throw setupError;
  }
  const schedule = JSON.parse(sql(`select json_build_object(
    'wakeLocal', to_char((clock_timestamp()+interval '20 minutes') at time zone 'Asia/Tokyo','YYYY-MM-DD"T"HH24:MI'),
    'departureLocal', to_char((clock_timestamp()+interval '70 minutes') at time zone 'Asia/Tokyo','YYYY-MM-DD"T"HH24:MI'),
    'flowAssignmentId', '${ids.assignments[0]}', 'errorAssignmentId', '${ids.assignments[1]}');`));
  return { email, password, ...schedule };
}

const mode = process.argv[2] ?? "setup";
if (mode === "setup") console.log(JSON.stringify(await setup()));
else if (mode === "cleanup") console.log(JSON.stringify(await cleanup()));
else throw new Error(`Unknown mode: ${mode}`);
