import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const localUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!localUrl.startsWith("http://127.0.0.1:") && !localUrl.startsWith("http://localhost:")) throw new Error(`Refusing non-local Supabase URL: ${localUrl}`);
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

const email = "ocv1-07c1-browser-worker@test.invalid";
const password = "OCV1-07C1-Local-QA-Only!";
const ids = {
  worker: "b7c10000-0000-0000-0000-000000000001",
  announcement: "b7c20000-0000-0000-0000-000000000001",
  recipient: "b7c30000-0000-0000-0000-000000000001",
  notification: "b7c40000-0000-4000-8000-000000000001",
};
const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const sql = (statement) => execFileSync("docker", psql, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const admin = createClient(localUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

async function findAuthUser() {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email === email);
    if (user || data.users.length < 100) return user ?? null;
  }
  throw new Error("Dedicated QA Auth lookup exceeded bounded pages.");
}

async function cleanup() {
  sql(`begin; set local session_replication_role=replica; delete from private.worker_notification_continuation_receipts where notification_id='${ids.notification}'; delete from public.in_app_notifications where id='${ids.notification}'; delete from public.announcement_recipients where id='${ids.recipient}'; delete from public.announcements where id='${ids.announcement}'; delete from public.workers where id='${ids.worker}'; commit;`);
  const user = await findAuthUser();
  if (user) {
    sql(`delete from public.profiles where id='${user.id}'::uuid;`);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
  const remainder = Number(sql(`select (select count(*) from auth.users where email='${email}')+(select count(*) from public.workers where id='${ids.worker}')+(select count(*) from public.announcements where id='${ids.announcement}')+(select count(*) from public.in_app_notifications where id='${ids.notification}')`));
  return { remainder };
}

async function setup() {
  await cleanup();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Dedicated QA Auth creation failed: ${error?.message ?? "no user"}`);
  try {
    sql(`begin;
      insert into public.profiles(id,display_name,account_type,is_active) values('${data.user.id}','OCV1-07C1 Browser Worker','worker',true);
      insert into public.workers(id,staff_code,branch_id,auth_profile_id,display_name,status) values('${ids.worker}','OCV107C1BROWSER','b0000000-0000-0000-0000-000000000001','${data.user.id}','OCV1-07C1 Browser Worker','active');
      insert into public.announcements(id,state,scope_type,branch_id,title,body,importance,published_at) values('${ids.announcement}','published','branch','b0000000-0000-0000-0000-000000000001','OCV1-07C1 安全な通知入口','この通知は専用ブラウザQA用です。','normal',clock_timestamp());
      set local session_replication_role=replica;
      insert into public.announcement_recipients(id,announcement_id,worker_id,recipient_profile_id) values('${ids.recipient}','${ids.announcement}','${ids.worker}','${data.user.id}');
      set local session_replication_role=origin;
      insert into public.in_app_notifications(id,recipient_profile_id,notification_type,source_announcement_id,title,summary) values('${ids.notification}','${data.user.id}','announcement_published','${ids.announcement}','LINEからの安全な通知入口','認証後に本人の通知だけを表示できることを確認します。');
    commit;`);
  } catch (setupError) {
    await cleanup();
    throw setupError;
  }
  return { ready: true, notificationId: ids.notification };
}

const mode = process.argv[2] ?? "setup";
if (mode === "setup") console.log(JSON.stringify(await setup()));
else if (mode === "cleanup") console.log(JSON.stringify(await cleanup()));
else throw new Error(`Unknown mode: ${mode}`);
