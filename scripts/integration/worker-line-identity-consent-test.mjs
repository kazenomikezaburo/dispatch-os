import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const actor = {
  workerA: "a0000000-0000-0000-0000-000000000001",
  workerB: "a0000000-0000-0000-0000-000000000002",
  manager: "a0000000-0000-0000-0000-000000000004",
  admin: "a0000000-0000-0000-0000-000000000005",
};
const lineA = `U${"a".repeat(32)}`;
const lineB = `U${"b".repeat(32)}`;
const secret = "ocv1-07c1-local-internal-command-secret";
const secretHash = createHash("sha256").update(secret).digest("hex");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const state = (suffix) => hash(`state-${suffix}`);
const nonce = (suffix) => hash(`nonce-${suffix}`);
let passed = 0;
let previousSecretHash;

function sql(statement, allowFailure = false) {
  try { return execFileSync("docker", psql, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (error) { if (allowFailure) return `${error.stdout ?? ""}${error.stderr ?? ""}`; throw error; }
}
function roleSql(profileId, statement, role = "authenticated") {
  return `begin; set local role ${role}; set local request.jwt.claims='{"sub":"${profileId}","role":"${role}"}'; ${statement}; commit;`;
}
function result(profileId, expression, role = "authenticated") {
  const output = sql(roleSql(profileId, `select (${expression})::text`, role));
  return JSON.parse(output.split(/\r?\n/).findLast((line) => line.trim().startsWith("{")));
}
function pass(name, condition) { assert.ok(condition, name); passed += 1; console.log(`PASS ${name}`); }
function cleanup() {
  sql(`delete from private.worker_notification_continuation_receipts where profile_id in ('${actor.workerA}','${actor.workerB}'); delete from private.line_webhook_receipts where webhook_event_id like 'ocv1-07c1-%'; delete from private.worker_line_link_transactions where profile_id in ('${actor.workerA}','${actor.workerB}'); delete from private.worker_line_links where profile_id in ('${actor.workerA}','${actor.workerB}');`);
}
function begin(profile, key) { return result(profile, `public.begin_own_line_link('${state(key)}','${nonce(key)}')`); }
function complete(profile, key, lineId, available = true, providedSecret = secret) {
  return result(profile, `public.complete_own_line_link('${state(key)}','${nonce(key)}','${lineId}',${available},'${providedSecret}')`);
}
function webhook(id, type, lineId, timestamp) {
  return JSON.parse(sql(`begin; set local role anon; select public.apply_line_friendship_webhook('${id}','${type}','${lineId}','${timestamp}'::timestamptz,'${secret}')::text; commit;`).split(/\r?\n/).findLast((line) => line.trim().startsWith("{")));
}

try {
  previousSecretHash = sql("select coalesce(internal_command_secret_sha256,'') from private.line_runtime_configuration where singleton");
  sql(`update private.line_runtime_configuration set internal_command_secret_sha256='${secretHash}',updated_at=clock_timestamp() where singleton`);
  cleanup();
  pass("anon cannot read link status", /permission denied/i.test(sql(roleSql("00000000-0000-0000-0000-000000000000", "select public.get_own_line_link_status()", "anon"), true)));
  pass("Manager cannot initiate Worker link", begin(actor.manager, "manager").code === "NOT_FOUND");
  pass("System Admin cannot initiate Worker link", begin(actor.admin, "admin").code === "NOT_FOUND");
  const inactiveOutput = sql(`begin; update public.workers set status='inactive' where auth_profile_id='${actor.workerB}'; set local role authenticated; set local request.jwt.claims='{"sub":"${actor.workerB}","role":"authenticated"}'; select public.begin_own_line_link('${state("inactive")}','${nonce("inactive")}')::text; rollback;`);
  pass("inactive Worker cannot initiate linking", JSON.parse(inactiveOutput.split(/\r?\n/).findLast((line) => line.trim().startsWith("{"))).code === "NOT_FOUND");
  pass("active Worker starts a ten-minute single-use transaction", begin(actor.workerA, "a").ok);
  pass("state mismatch is rejected", complete(actor.workerA, "wrong", lineA).code === "LINK_TRANSACTION_INVALID");
  pass("nonce mismatch is rejected", result(actor.workerA, `public.complete_own_line_link('${state("a")}','${nonce("wrong")}','${lineA}',true,'${secret}')`).code === "LINK_TRANSACTION_INVALID");
  pass("browser cannot complete without internal secret", complete(actor.workerA, "a", lineA, true, "browser-has-no-trusted-secret-value").code === "NOT_FOUND");
  const linked = complete(actor.workerA, "a", lineA);
  pass("verified callback links available destination", linked.ok && linked.status === "linked_available");
  pass("new link defaults consent to disabled", linked.external_reminders_enabled === false);
  pass("callback replay is rejected", complete(actor.workerA, "a", lineA).code === "LINK_TRANSACTION_INVALID");
  pass("status projection never exposes LINE user ID", !JSON.stringify(result(actor.workerA, "public.get_own_line_link_status()")).includes(lineA));
  pass("enable records consent watermark", result(actor.workerA, "public.set_own_line_reminders_enabled(true)").enabled_at !== null);
  const watermark = sql(`select enabled_at from private.worker_line_links where profile_id='${actor.workerA}'`);
  pass("same enable is stable and preserves watermark", result(actor.workerA, "public.set_own_line_reminders_enabled(true)").replayed && sql(`select enabled_at from private.worker_line_links where profile_id='${actor.workerA}'`) === watermark);
  pass("disable is immediate", result(actor.workerA, "public.set_own_line_reminders_enabled(false)").external_reminders_enabled === false);

  pass("second Worker can start linking", begin(actor.workerB, "b").ok);
  pass("Provider-scoped LINE identity cannot move across Workers", complete(actor.workerB, "b", lineA).code === "LINK_CONFLICT");
  pass("LINE identity collision discloses no owner", !JSON.stringify(complete(actor.workerB, "b", lineA)).includes(actor.workerA));

  pass("fresh transaction replaces prior active transaction", begin(actor.workerA, "old").ok && begin(actor.workerA, "new").ok);
  pass("replaced transaction cannot complete", complete(actor.workerA, "old", lineB).code === "LINK_TRANSACTION_INVALID");
  pass("re-link succeeds", complete(actor.workerA, "new", lineB).ok);
  const relinked = result(actor.workerA, "public.get_own_line_link_status()");
  pass("re-link never silently re-enables consent", relinked.external_reminders_enabled === false && relinked.enabled_at === null);

  begin(actor.workerB, "expired");
  sql(`update private.worker_line_link_transactions set created_at=clock_timestamp()-interval '20 minutes', expires_at=clock_timestamp()-interval '10 minutes' where profile_id='${actor.workerB}' and state_hash='${state("expired")}'`);
  pass("expired transaction is rejected", complete(actor.workerB, "expired", lineA).code === "LINK_TRANSACTION_INVALID");

  const unfollowTime = new Date(Date.now() + 1_000).toISOString();
  const unfollow = webhook("ocv1-07c1-unfollow", "unfollow", lineB, unfollowTime);
  pass("verified unfollow marks destination unavailable", unfollow.outcome === "applied" && result(actor.workerA, "public.get_own_line_link_status()").status === "linked_unavailable");
  pass("unavailable destination cannot enable", result(actor.workerA, "public.set_own_line_reminders_enabled(true)").code === "DESTINATION_UNAVAILABLE");
  pass("duplicate webhook is replay-safe", webhook("ocv1-07c1-unfollow", "unfollow", lineB, unfollowTime).replayed === true);
  pass("stale follow cannot overwrite newer unfollow", webhook("ocv1-07c1-stale", "follow", lineB, new Date(Date.now() - 60_000).toISOString()).outcome === "stale" && result(actor.workerA, "public.get_own_line_link_status()").status === "linked_unavailable");
  const follow = webhook("ocv1-07c1-follow", "follow", lineB, new Date(Date.now() + 2_000).toISOString());
  pass("newer follow restores availability", follow.outcome === "applied" && result(actor.workerA, "public.get_own_line_link_status()").status === "linked_available");
  pass("follow never silently enables consent", result(actor.workerA, "public.get_own_line_link_status()").externalRemindersEnabled !== true && result(actor.workerA, "public.get_own_line_link_status()").external_reminders_enabled === false);

  const ownNotification = sql(`select id from public.in_app_notifications where recipient_profile_id='${actor.workerA}' order by created_at limit 1`);
  pass("own Notification continuation is consumed", result(actor.workerA, `public.consume_own_notification_continuation('${ownNotification}','${hash("continue-own")}',clock_timestamp()+interval '5 minutes')`).ok);
  pass("continuation replay is rejected", result(actor.workerA, `public.consume_own_notification_continuation('${ownNotification}','${hash("continue-own")}',clock_timestamp()+interval '5 minutes')`).code === "CONTINUATION_REPLAY");
  pass("foreign Notification is safely hidden", result(actor.workerB, `public.consume_own_notification_continuation('${ownNotification}','${hash("continue-foreign")}',clock_timestamp()+interval '5 minutes')`).code === "NOT_FOUND");
  pass("missing Notification is safely hidden", result(actor.workerA, `public.consume_own_notification_continuation('ffffffff-ffff-4fff-8fff-ffffffffffff','${hash("continue-missing")}',clock_timestamp()+interval '5 minutes')`).code === "NOT_FOUND");
  pass("expired continuation is rejected", result(actor.workerA, `public.consume_own_notification_continuation('${ownNotification}','${hash("continue-expired")}',clock_timestamp()-interval '1 second')`).code === "INVALID_CONTINUATION");

  pass("direct private table reads are denied to Worker", /permission denied/i.test(sql(roleSql(actor.workerA, "select * from private.worker_line_links"), true)));
  pass("direct private table writes are denied to Worker", /permission denied/i.test(sql(roleSql(actor.workerA, `delete from private.worker_line_links where profile_id='${actor.workerA}'`), true)));
  pass("all private LINE tables have RLS and no runtime grants", sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in('worker_line_links','worker_line_link_transactions','line_webhook_receipts','worker_notification_continuation_receipts','line_runtime_configuration') and c.relrowsecurity and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE')") === "5");
  pass("link persistence contains no provider tokens or display profile columns", sql("select count(*) from information_schema.columns where table_schema='private' and table_name like '%line%' and column_name in('access_token','refresh_token','id_token','display_name','email','profile_image_url')") === "0");

  const journeyBefore = sql("select count(*) from public.assignment_journey_event_versions");
  const attendanceBefore = sql("select count(*) from public.attendance_events");
  const readBefore = sql("select count(*) from public.in_app_notifications where read_at is not null");
  pass("unlink removes live destination", result(actor.workerA, "public.unlink_own_line_account()").ok && result(actor.workerA, "public.get_own_line_link_status()").status === "unlinked");
  pass("unlink retry is stable", result(actor.workerA, "public.unlink_own_line_account()").replayed === true);
  pass("LINE commands never mutate Journey", sql("select count(*) from public.assignment_journey_event_versions") === journeyBefore);
  pass("LINE commands never mutate Attendance", sql("select count(*) from public.attendance_events") === attendanceBefore);
  pass("LINE commands never mutate Notification read state", sql("select count(*) from public.in_app_notifications where read_at is not null") === readBefore);
} finally {
  cleanup();
  sql(previousSecretHash
    ? `update private.line_runtime_configuration set internal_command_secret_sha256='${previousSecretHash}',updated_at=clock_timestamp() where singleton`
    : "update private.line_runtime_configuration set internal_command_secret_sha256=null,updated_at=clock_timestamp() where singleton");
}

pass("dedicated LINE fixtures cleaned", sql(`select (select count(*) from private.worker_line_links where profile_id in ('${actor.workerA}','${actor.workerB}'))+(select count(*) from private.worker_line_link_transactions where profile_id in ('${actor.workerA}','${actor.workerB}'))+(select count(*) from private.line_webhook_receipts where webhook_event_id like 'ocv1-07c1-%')+(select count(*) from private.worker_notification_continuation_receipts where profile_id in ('${actor.workerA}','${actor.workerB}'))`) === "0");
console.log(`Worker LINE identity and consent: PASS (${passed} assertions)`);
