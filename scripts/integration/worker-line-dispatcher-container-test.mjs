import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const image = "opscue-line-dispatcher:c2-05-local";
const worker = "a0000000-0000-0000-0000-000000000001";
const notification = "c2050000-0000-4000-8000-000000000001";
const canaryNotification = "c2050000-0000-4000-8000-000000000002";
const lineUser = "Udddddddddddddddddddddddddddddddd";
const localPassword = "c2-05-local-dispatcher-only";
const psql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const adminPsql = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
let occurrence = "";
let canaryOccurrence = "";

function sql(statement, admin = false) {
  return execFileSync("docker", admin ? adminPsql : psql, { input: statement, encoding: "utf8" }).trim();
}

function cleanup() {
  sql(`
    begin;
    set local session_replication_role=replica;
    alter table private.line_delivery_attempt_results disable trigger reject_line_delivery_attempt_result_mutation;
    delete from private.line_delivery_attempt_results where attempt_start_id in (
      select a.id from private.line_delivery_attempt_starts a join private.line_notification_deliveries d on d.id=a.delivery_id
      where d.notification_id in ('${notification}','${canaryNotification}')
    );
    alter table private.line_delivery_attempt_results enable trigger reject_line_delivery_attempt_result_mutation;
    alter table private.line_delivery_attempt_starts disable trigger reject_line_delivery_attempt_start_mutation;
    delete from private.line_delivery_attempt_starts where delivery_id in (
      select id from private.line_notification_deliveries where notification_id in ('${notification}','${canaryNotification}')
    );
    alter table private.line_delivery_attempt_starts enable trigger reject_line_delivery_attempt_start_mutation;
    delete from private.line_delivery_canary_scopes where delivery_id in (select id from private.line_notification_deliveries where notification_id in ('${notification}','${canaryNotification}'));
    delete from private.line_notification_deliveries where notification_id in ('${notification}','${canaryNotification}');
    delete from public.in_app_notifications where id in ('${notification}','${canaryNotification}');
    delete from private.scheduled_worker_reminder_occurrences where id in ('${occurrence || "00000000-0000-0000-0000-000000000000"}','${canaryOccurrence || "00000000-0000-0000-0000-000000000000"}');
    delete from private.worker_line_links where profile_id='${worker}' and line_user_id='${lineUser}';
    commit;
  `, true);
}

try {
  cleanup();
  occurrence = sql("select gen_random_uuid();");
  sql(`
    alter role opscue_line_dispatcher password '${localPassword}';
    alter role opscue_line_canary_dispatcher password '${localPassword}';
    begin;
    insert into private.worker_line_links(
      profile_id,line_user_id,destination_status,external_reminders_enabled,enabled_at,linked_at,availability_event_at,updated_at
    ) values (
      '${worker}','${lineUser}','linked_available',true,clock_timestamp()-interval '1 minute',clock_timestamp(),clock_timestamp(),clock_timestamp()
    );
    insert into private.scheduled_worker_reminder_occurrences(
      id,assignment_id,recipient_profile_id,reminder_type,phase,eligible_at,due_at,notification_id,created_at
    ) values (
      '${occurrence}',gen_random_uuid(),'${worker}','arrival_reminder','approaching',clock_timestamp(),clock_timestamp(),'${notification}',clock_timestamp()
    );
    insert into public.in_app_notifications(
      id,recipient_profile_id,notification_type,source_incident_event_id,source_announcement_id,
      source_pre_confirmation_reminder_id,source_scheduled_worker_reminder_id,title,summary,created_at
    ) values (
      '${notification}','${worker}','arrival_reminder',null,null,null,'${occurrence}',
      '到着時刻が近づいています','勤務詳細を確認し、到着したら記録してください。',clock_timestamp()
    );
    commit;
  `);

  await execFileAsync("docker", ["build", "-f", "Dockerfile.line-dispatcher", "-t", image, "."], { maxBuffer: 8 * 1024 * 1024 });
  const disabled = await execFileAsync("docker", ["run", "--rm", image], { maxBuffer: 1024 * 1024 });
  const disabledLog = JSON.parse(disabled.stdout.trim());
  assert.equal(disabledLog.outcome, "disabled");
  assert.equal(disabledLog.claimed, 0);
  assert.equal(sql(`select attempt_count from private.line_notification_deliveries where notification_id='${notification}';`), "0");

  await assert.rejects(() => execFileAsync("docker", [
    "run", "--rm",
    "-e", "NODE_ENV=test",
    "-e", "LINE_DELIVERY_ENABLED=true",
    "-e", "LINE_DELIVERY_MODE=canary",
    "-e", "LINE_CANARY_SCOPE_ID=ffffffff-ffff-4fff-8fff-ffffffffffff",
    "-e", "LINE_DELIVERY_BATCH_SIZE=1",
    "-e", "OPSCUE_LINE_DISPATCHER_DATABASE_URL=postgresql://normal.invalid/postgres",
    "-e", "OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL=postgresql://canary.invalid/postgres",
    image,
  ], { maxBuffer: 1024 * 1024 }));
  assert.equal(sql(`select attempt_count from private.line_notification_deliveries where notification_id='${notification}';`), "0");

  let providerCalls = 0;
  let providerRetryKey = "";
  let providerBody;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      providerCalls += 1;
      providerRetryKey = String(request.headers["x-line-retry-key"] ?? "");
      providerBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(200, { "x-line-request-id": "c205-mock-request", "content-type": "application/json" });
      response.end("{}");
    });
  });
  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const run = await execFileAsync("docker", [
      "run", "--rm",
      "-e", "NODE_ENV=test",
      "-e", "LINE_DELIVERY_ENABLED=true",
      "-e", "LINE_DELIVERY_BATCH_SIZE=1",
      "-e", "LINE_PUSH_TIMEOUT_MS=3000",
      "-e", "LINE_DISPATCHER_MAX_RUNTIME_MS=15000",
      "-e", "OPSCUE_ALLOW_INSECURE_LOCAL_DISPATCHER_DB=true",
      "-e", "LINE_PROVIDER_MOCK_MODE=true",
      "-e", `LINE_PROVIDER_MOCK_ENDPOINT=http://host.docker.internal:${address.port}/v2/bot/message/push`,
      "-e", "OPSCUE_APP_ORIGIN=https://opscue.example",
      "-e", "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=local-mock-messaging-token-value",
      "-e", `OPSCUE_LINE_DISPATCHER_DATABASE_URL=postgresql://opscue_line_dispatcher:${localPassword}@host.docker.internal:54322/postgres`,
      image,
    ], { maxBuffer: 1024 * 1024 });
    const log = JSON.parse(run.stdout.trim());
    assert.equal(log.outcome, "succeeded");
    assert.equal(log.delivered, 1);

    assert.equal(providerCalls, 1);
    assert.equal(providerRetryKey, sql(`select retry_key from private.line_notification_deliveries where notification_id='${notification}';`));
    assert.deepEqual(providerBody, {
      to: lineUser,
      messages: [{
        type: "text",
        text: `到着時刻が近づいています\n勤務詳細を確認し、到着したら記録してください。\nhttps://opscue.example/worker/notifications/${notification}`,
      }],
    });

    canaryOccurrence = sql("select gen_random_uuid();");
    sql(`
      begin;
      insert into private.scheduled_worker_reminder_occurrences(
        id,assignment_id,recipient_profile_id,reminder_type,phase,eligible_at,due_at,notification_id,created_at
      ) values (
        '${canaryOccurrence}',gen_random_uuid(),'${worker}','arrival_reminder','approaching',clock_timestamp(),clock_timestamp(),'${canaryNotification}',clock_timestamp()
      );
      insert into public.in_app_notifications(
        id,recipient_profile_id,notification_type,source_incident_event_id,source_announcement_id,
        source_pre_confirmation_reminder_id,source_scheduled_worker_reminder_id,title,summary,created_at
      ) values (
        '${canaryNotification}','${worker}','arrival_reminder',null,null,null,'${canaryOccurrence}',
        'Canary reminder','Controlled canary summary',clock_timestamp()
      );
      commit;
    `);
    const scopeId = sql(`select private.create_line_delivery_canary_scope('${canaryNotification}','${worker}',15);`);
    providerCalls = 0;
    const canaryRun = await execFileAsync("docker", [
      "run", "--rm",
      "-e", "NODE_ENV=test",
      "-e", "LINE_DELIVERY_ENABLED=true",
      "-e", "LINE_DELIVERY_MODE=canary",
      "-e", `LINE_CANARY_SCOPE_ID=${scopeId}`,
      "-e", "LINE_DELIVERY_BATCH_SIZE=1",
      "-e", "LINE_PUSH_TIMEOUT_MS=3000",
      "-e", "LINE_DISPATCHER_MAX_RUNTIME_MS=15000",
      "-e", "OPSCUE_ALLOW_INSECURE_LOCAL_DISPATCHER_DB=true",
      "-e", "LINE_PROVIDER_MOCK_MODE=true",
      "-e", `LINE_PROVIDER_MOCK_ENDPOINT=http://host.docker.internal:${address.port}/v2/bot/message/push`,
      "-e", "OPSCUE_APP_ORIGIN=https://opscue.example",
      "-e", "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=local-mock-messaging-token-value",
      "-e", `OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL=postgresql://opscue_line_canary_dispatcher:${localPassword}@host.docker.internal:54322/postgres`,
      image,
    ], { maxBuffer: 1024 * 1024 });
    const canaryLog = JSON.parse(canaryRun.stdout.trim());
    assert.equal(canaryLog.outcome, "succeeded");
    assert.equal(canaryLog.claimed, 1);
    assert.equal(canaryLog.delivered, 1);
    assert.equal(providerCalls, 1);
    assert.equal(sql(`select status from private.line_notification_deliveries where notification_id='${canaryNotification}'`), "delivered");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  assert.equal(sql(`select status||'|'||status_reason||'|'||attempt_count from private.line_notification_deliveries where notification_id='${notification}';`), "delivered|provider_accepted|1");
  console.log("Worker LINE dispatcher normal/canary container: PASS");
} finally {
  cleanup();
  sql("alter role opscue_line_dispatcher password null;");
  sql("alter role opscue_line_canary_dispatcher password null;");
}
