import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-q"];
const actors = {
  workerA: "a0000000-0000-0000-0000-000000000001",
  workerB: "a0000000-0000-0000-0000-000000000002",
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const nagoya = "b0000000-0000-0000-0000-000000000001";
const prefix = "INT29E ";
const keyPrefix = "int-2.9e-";

function run(sql, { allowFailure = false } = {}) {
  try {
    return execFileSync("docker", dockerArgs, { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    throw error;
  }
}

function roleSql(profileId, body, role = "authenticated") {
  return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; ${body} commit;`;
}

function result(sql) {
  return JSON.parse(run(sql).split(/\r?\n/).at(-1));
}

function rpc(actor, expression) {
  return result(roleSql(actor, `select (${expression})::text;`));
}

function create(actor, scope, branch, title, body, key) {
  return rpc(actor, `public.create_announcement_draft('${scope}',${branch ? `'${branch}'::uuid` : "null"},'${title}','${body}','important','${key}')`);
}

function publish(actor, id, key) {
  return rpc(actor, `public.publish_announcement('${id}'::uuid,1,'${key}')`);
}

function project(actor, id) {
  return rpc(actor, `public.project_announcement_in_app_notifications('${id}'::uuid)`);
}

function concurrentProject(actor, id) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)))
      : reject(new Error(stderr || stdout)));
    child.stdin.end(roleSql(actor, `select public.project_announcement_in_app_notifications('${id}'::uuid)::text;`));
  });
}

let passed = 0;
function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function cleanup() {
  run(`begin;
delete from public.in_app_notifications where source_announcement_id in (select id from public.announcements where title like '${prefix}%');
alter table public.announcement_recipients disable trigger enforce_announcement_recipient_immutability;
alter table public.announcements disable trigger enforce_announcement_delete;
delete from public.announcement_recipients where announcement_id in (select id from public.announcements where title like '${prefix}%');
delete from public.announcements where title like '${prefix}%';
delete from private.announcement_command_receipts where idempotency_key like '${keyPrefix}%';
alter table public.announcement_recipients enable trigger enforce_announcement_recipient_immutability;
alter table public.announcements enable trigger enforce_announcement_delete;
commit;`);
}

try {
  cleanup();

  const draft = create(actors.manager, "branch", nagoya, `${prefix}Branch`, "  first   line\nsecond line  ", `${keyPrefix}create-branch`);
  pass("Manager creates a branch draft", draft.ok && draft.state === "draft");
  pass("draft projection is safely rejected", project(actors.manager, draft.announcement_id).code === "NOT_APPLICABLE");
  pass("draft never creates notifications", run(`select count(*)::text from public.in_app_notifications where source_announcement_id='${draft.announcement_id}';`) === "0");

  const publication = publish(actors.manager, draft.announcement_id, `${keyPrefix}publish-branch`);
  pass("canonical publish freezes branch recipients", publication.ok && publication.recipient_count === 2);
  const projected = project(actors.manager, draft.announcement_id);
  pass("published Announcement projects one notification per frozen recipient", projected.ok && projected.created_count === 2 && projected.recipient_count === 2);
  pass("projection stores controlled type, title, and collapsed 240-char summary", run(`select (count(*)=2 and bool_and(notification_type='announcement_published' and title='${prefix}Branch' and summary='first line second line' and char_length(summary)<=240))::text from public.in_app_notifications where source_announcement_id='${draft.announcement_id}';`) === "true");
  const originalRows = run(`select string_agg(id::text||':'||created_at::text,',' order by id) from public.in_app_notifications where source_announcement_id='${draft.announcement_id}';`);
  const replay = project(actors.manager, draft.announcement_id);
  pass("projection rerun creates zero notifications", replay.ok && replay.replayed && replay.created_count === 0);
  pass("projection rerun leaves existing notifications unchanged", run(`select string_agg(id::text||':'||created_at::text,',' order by id) from public.in_app_notifications where source_announcement_id='${draft.announcement_id}';`) === originalRows);

  const raceDraft = create(actors.manager, "branch", nagoya, `${prefix}Race`, "race body", `${keyPrefix}create-race`);
  publish(actors.manager, raceDraft.announcement_id, `${keyPrefix}publish-race`);
  const raceResults = await Promise.all([concurrentProject(actors.manager, raceDraft.announcement_id), concurrentProject(actors.manager, raceDraft.announcement_id)]);
  pass("concurrent projection calls both converge successfully", raceResults.every((item) => item.ok));
  pass("concurrent projection writes exactly one notification and receipt per recipient", run(`select ((select count(*) from public.in_app_notifications where source_announcement_id='${raceDraft.announcement_id}')=2 and (select count(*) from private.announcement_notification_projection_receipts where announcement_id='${raceDraft.announcement_id}')=2)::text;`) === "true");

  const notificationId = run(`select id::text from public.in_app_notifications where source_announcement_id='${draft.announcement_id}' and recipient_profile_id='${actors.workerA}';`);
  const read = rpc(actors.workerA, `public.mark_in_app_notification_read('${notificationId}'::uuid)`);
  pass("Announcement notification uses existing first-read contract", read.ok && !read.replayed);
  pass("own resolver returns only the canonical Announcement identity", (() => { const value = rpc(actors.workerA, `public.resolve_announcement_notification_source_context('${notificationId}'::uuid)`); return value.ok && value.source_available && value.announcement_id === draft.announcement_id && Object.keys(value).sort().join(",") === "announcement_id,ok,source_available"; })());
  pass("foreign Worker receives safe unavailable", (() => { const value = rpc(actors.workerB, `public.resolve_announcement_notification_source_context('${notificationId}'::uuid)`); return value.ok && !value.source_available && value.announcement_id === null; })());
  pass("Incident resolver safely rejects Announcement notification", (() => { const value = rpc(actors.workerA, `public.resolve_in_app_notification_source_context('${notificationId}'::uuid)`); return value.ok && !value.source_available && value.assignment_id === null; })());
  pass("foreign Worker cannot select another recipient notification", run(roleSql(actors.workerB, `select count(*)::text from public.in_app_notifications where id='${notificationId}';`)).endsWith("0"));

  run(`delete from public.in_app_notifications where id='${notificationId}';`);
  pass("missing derived notification and cascaded receipt are discovered", run(`select count(*)::text from private.list_unprojected_announcement_notification_recipients(null,null,null,100) where announcement_id='${draft.announcement_id}' and recipient_profile_id='${actors.workerA}';`) === "1");
  const recovered = project(actors.manager, draft.announcement_id);
  pass("projection rerun recovers only the missing recipient", recovered.ok && recovered.created_count === 1);
  const recoveredId = run(`select id::text from public.in_app_notifications where source_announcement_id='${draft.announcement_id}' and recipient_profile_id='${actors.workerA}';`);
  const recoveredRead = rpc(actors.workerA, `public.mark_in_app_notification_read('${recoveredId}'::uuid)`);
  project(actors.manager, draft.announcement_id);
  pass("reconciliation rerun reports zero missing", run(`select count(*)::text from private.list_unprojected_announcement_notification_recipients(null,null,null,100) where announcement_id='${draft.announcement_id}';`) === "0");
  pass("reconciliation rerun preserves read_at", run(`select (read_at='${recoveredRead.read_at}'::timestamptz)::text from public.in_app_notifications where id='${recoveredId}';`) === "true");

  const orgDraft = create(actors.admin, "organization", null, `${prefix}Organization`, "organization body", `${keyPrefix}create-org`);
  const orgPublication = publish(actors.admin, orgDraft.announcement_id, `${keyPrefix}publish-org`);
  const orgProjection = project(actors.admin, orgDraft.announcement_id);
  pass("System Admin organization publication projects all frozen recipients", orgPublication.ok && orgProjection.ok && orgProjection.created_count === orgPublication.recipient_count);
  pass("Manager remains unable to publish organization scope", create(actors.manager, "organization", null, `${prefix}Forbidden`, "body", `${keyPrefix}manager-org`).code === "NOT_FOUND");

  const archived = rpc(actors.manager, `public.archive_announcement('${draft.announcement_id}'::uuid,2,'${keyPrefix}archive-branch')`);
  pass("Announcement archives without deleting notification history", archived.ok && run(`select count(*)::text from public.in_app_notifications where source_announcement_id='${draft.announcement_id}';`) === "2");
  pass("archive makes source resolver safely unavailable", (() => { const value = rpc(actors.workerA, `public.resolve_announcement_notification_source_context('${recoveredId}'::uuid)`); return value.ok && !value.source_available && value.announcement_id === null; })());
  pass("archived projection creates nothing new", project(actors.manager, draft.announcement_id).code === "NOT_APPLICABLE" && run(`select count(*)::text from public.in_app_notifications where source_announcement_id='${draft.announcement_id}';`) === "2");

  pass("Worker cannot invoke trusted projection", project(actors.workerA, orgDraft.announcement_id).code === "NOT_FOUND");
  pass("reconciliation is bounded and unavailable to runtime roles", Number(run(`select count(*)::text from private.list_unprojected_announcement_notification_recipients(null,null,null,1000);`)) <= 100 && run(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['public','anon','authenticated','service_role']) r where n.nspname='private' and p.proname='list_unprojected_announcement_notification_recipients';`) === "true");
  pass("new public functions are hardened and role-scoped", run(`select bool_and(p.prosecdef and p.proconfig[1]='search_path=""' and has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('public',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('project_announcement_in_app_notifications','resolve_announcement_notification_source_context');`) === "true");
  pass("notification type and source-kind invariant rejects mismatches", run(`insert into public.in_app_notifications(recipient_profile_id,notification_type,source_incident_event_id,source_announcement_id,title,summary) values('${actors.workerA}','announcement_published','00000000-0000-0000-0000-000000000000','${orgDraft.announcement_id}','x','x');`, { allowFailure: true }).includes("in_app_notifications_source_shape_check"));
} finally {
  cleanup();
}

pass("Announcement integration fixtures are fully cleaned up", run(`select ((select count(*) from public.announcements where title like '${prefix}%')+(select count(*) from public.in_app_notifications where source_announcement_id in (select id from public.announcements where title like '${prefix}%'))+(select count(*) from private.announcement_command_receipts where idempotency_key like '${keyPrefix}%'))::text;`) === "0");
console.log(`Announcement Notification Integration: ${passed}/${passed} passed`);
