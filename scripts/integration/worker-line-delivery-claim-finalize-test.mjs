import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const workerA = "a0000000-0000-0000-0000-000000000001";
const workerB = "a0000000-0000-0000-0000-000000000002";
const notificationIds = Array.from({ length: 24 }, (_, index) => `c2030000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
let passed = 0;

function run(statement) {
  return execFileSync("docker", dockerArgs, { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function runAdmin(statement) {
  const adminArgs = [...dockerArgs.slice(0, 5), "supabase_admin", ...dockerArgs.slice(6)];
  return execFileSync("docker", adminArgs, {
    input: statement,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

async function runAsync(statement) {
  const { stdout } = await execFileAsync("docker", [...dockerArgs, "-c", statement], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function pass(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function parseJson(output) {
  const line = output.split(/\r?\n/).find((value) => value.trim().startsWith("{"));
  return line ? JSON.parse(line) : null;
}

function claimOne() {
  return parseJson(run("select row_to_json(claim)::text from private.claim_line_deliveries(1) as claim;"));
}

function finalize(claim, args) {
  const values = {
    kind: "http",
    status: "null",
    retryAfter: "null",
    accepted: "false",
    safeCode: "null",
    requestId: "null",
    ...args,
  };
  return JSON.parse(run(`select private.finalize_line_delivery(
    '${claim.delivery_id}','${claim.lease_token}','${values.kind}',${values.status},${values.retryAfter},
    ${values.accepted},${values.safeCode},${values.requestId}
  )::text;`));
}

function delivery(id) {
  return JSON.parse(run(`select json_build_object(
    'id',id,'status',status,'reason',status_reason,'attempts',attempt_count,
    'retry_key',retry_key,'next_at',next_attempt_at,'lease',lease_token
  )::text from private.line_notification_deliveries where notification_id='${id}';`));
}

function cleanup() {
  const ids = notificationIds.map((id) => `'${id}'`).join(",");
  runAdmin(`
    begin;
    set local session_replication_role=replica;
    create temporary table c203_occurrence_ids on commit drop as
      select source_scheduled_worker_reminder_id as id
      from public.in_app_notifications where id in (${ids})
      union
      select id from private.scheduled_worker_reminder_occurrences where notification_id in (${ids});
    alter table private.line_delivery_attempt_results disable trigger reject_line_delivery_attempt_result_mutation;
    delete from private.line_delivery_attempt_results where attempt_start_id in (
      select attempt.id from private.line_delivery_attempt_starts as attempt
      join private.line_notification_deliveries as delivery on delivery.id=attempt.delivery_id
      where delivery.notification_id in (${ids})
    );
    alter table private.line_delivery_attempt_results enable trigger reject_line_delivery_attempt_result_mutation;
    alter table private.line_delivery_attempt_starts disable trigger reject_line_delivery_attempt_start_mutation;
    delete from private.line_delivery_attempt_starts where delivery_id in (
      select id from private.line_notification_deliveries where notification_id in (${ids})
    );
    alter table private.line_delivery_attempt_starts enable trigger reject_line_delivery_attempt_start_mutation;
    delete from private.line_notification_deliveries where notification_id in (${ids});
    delete from private.scheduled_worker_reminder_occurrences where id in (select id from c203_occurrence_ids);
    delete from public.in_app_notifications where id in (${ids});
    delete from private.worker_line_links where profile_id in ('${workerA}','${workerB}')
      and line_user_id in ('Ueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','Uffffffffffffffffffffffffffffffff');
    commit;
  `);
}

function setup() {
  const rows = notificationIds.map((id, index) => {
    const profile = index < 22 ? workerA : workerB;
    const type = ["pre_confirmation_reminder", "wake_reminder", "departure_reminder", "arrival_reminder"][index % 4];
    const phase = type === "pre_confirmation_reminder" || index % 2 === 0 ? "approaching" : "overdue";
    return `
      v_occurrence := gen_random_uuid();
      insert into private.scheduled_worker_reminder_occurrences(
        id,assignment_id,recipient_profile_id,reminder_type,phase,eligible_at,due_at,notification_id,created_at
      ) values (
        v_occurrence,gen_random_uuid(),'${profile}','${type}','${phase}',v_now,v_now,'${id}',v_now+interval '${index} milliseconds'
      );
      insert into public.in_app_notifications(
        id,recipient_profile_id,notification_type,source_incident_event_id,source_announcement_id,
        source_pre_confirmation_reminder_id,source_scheduled_worker_reminder_id,title,summary,created_at
      ) values (
        '${id}','${profile}','${type}',null,null,null,v_occurrence,
        'C2 claim test','Controlled reminder summary',v_now+interval '${index} milliseconds'
      );`;
  }).join("\n");

  run(`
    begin;
    do $body$
    begin
      if exists(select 1 from private.worker_line_links where profile_id in ('${workerA}','${workerB}')) then
        raise exception 'dedicated Worker already has a LINE link';
      end if;
      if not private.is_active_worker_profile('${workerA}') or not private.is_active_worker_profile('${workerB}') then
        raise exception 'dedicated Worker fixture is inactive';
      end if;
    end;
    $body$;
    insert into private.worker_line_links(
      profile_id,line_user_id,destination_status,external_reminders_enabled,enabled_at,
      linked_at,availability_event_at,updated_at
    ) values
      ('${workerA}','Ueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','linked_available',true,clock_timestamp()-interval '1 minute',clock_timestamp(),clock_timestamp(),clock_timestamp()),
      ('${workerB}','Uffffffffffffffffffffffffffffffff','linked_available',true,clock_timestamp()-interval '1 minute',clock_timestamp(),clock_timestamp(),clock_timestamp());
    do $body$
    declare v_now timestamptz:=clock_timestamp(); v_occurrence uuid;
    begin
      ${rows}
    end;
    $body$;
    commit;
  `);
}

try {
  cleanup();
  setup();

  const concurrentSql = "begin; select row_to_json(claim)::text from private.claim_line_deliveries(1) as claim; select pg_sleep(2); commit;";
  const [parallelA, parallelB] = await Promise.all([runAsync(concurrentSql), runAsync(concurrentSql)]);
  const claimA = parseJson(parallelA);
  const claimB = parseJson(parallelB);
  pass("parallel SKIP LOCKED claims both return", claimA && claimB);
  pass("parallel claims never share a delivery", claimA.delivery_id !== claimB.delivery_id);
  pass("claim creates a 60-second lease", [claimA, claimB].every((claim) => delivery(claim.notification_id).lease === claim.lease_token));
  pass("claim atomically appends attempt start", run(`select count(*) from private.line_delivery_attempt_starts where lease_token in ('${claimA.lease_token}','${claimB.lease_token}')`) === "2");
  pass("claim exposes one stable retry key", Boolean(claimA.retry_key && claimB.retry_key));

  const delivered = finalize(claimA, { status: "200" });
  pass("2xx finalizes delivered", delivered.ok && delivered.status === "delivered" && delivered.reason === "provider_accepted");
  const duplicate = finalize(claimA, { status: "200" });
  pass("duplicate finalize is rejected", !duplicate.ok && duplicate.code === "STALE_LEASE");
  const accepted409 = finalize(claimB, { status: "409", accepted: "true", requestId: "'accepted-request-1'" });
  pass("confirmed same-key 409 finalizes delivered", accepted409.status === "delivered" && accepted409.reason === "provider_already_accepted");

  const retryCases = [
    [{ kind: "http", status: "408" }, "timeout", 60],
    [{ kind: "http", status: "429", retryAfter: "600" }, "rate_limited", 600],
    [{ kind: "http", status: "503" }, "provider_unavailable", 60],
    [{ kind: "timeout" }, "timeout", 60],
    [{ kind: "network" }, "network", 60],
  ];
  for (const [args, reason, minimumDelay] of retryCases) {
    const claim = claimOne();
    const before = Date.now();
    const result = finalize(claim, args);
    const after = Date.now();
    const nextAt = Date.parse(result.next_attempt_at);
    pass(`${reason} is retryable`, result.status === "retryable_failure" && result.reason === reason);
    pass(`${reason} retry delay is bounded`, nextAt >= before + minimumDelay * 1000 - 2000 && nextAt <= after + minimumDelay * 1000 + 2000);
  }

  const terminalCases = [
    [{ status: "400" }, "invalid_request"],
    [{ status: "401" }, "provider_auth"],
    [{ status: "403" }, "provider_forbidden"],
    [{ status: "404", safeCode: "'invalid_destination'" }, "invalid_destination"],
    [{ status: "409" }, "provider_rejected"],
  ];
  for (const [args, reason] of terminalCases) {
    const claim = claimOne();
    const result = finalize(claim, args);
    pass(`${reason} is terminal`, result.status === "terminal_failure" && result.reason === reason);
  }

  const staleClaim = claimOne();
  const stale = { ...staleClaim, lease_token: "ffffffff-ffff-4fff-8fff-ffffffffffff" };
  pass("stale lease token is rejected", finalize(stale, { status: "200" }).code === "STALE_LEASE");
  pass("live lease prevents a second claim", claimOne()?.delivery_id !== staleClaim.delivery_id);
  finalize(staleClaim, { status: "200" });

  const crashClaim = claimOne();
  const crashRetryKey = crashClaim.retry_key;
  run(`update private.line_notification_deliveries set lease_expires_at=clock_timestamp()-interval '1 second' where id='${crashClaim.delivery_id}';`);
  privateClaimRecovery();
  function privateClaimRecovery() {
    run("select count(*) from private.claim_line_deliveries(1);");
  }
  const recovered = delivery(crashClaim.notification_id);
  pass("expired lease records unknown result", run(`select count(*) from private.line_delivery_attempt_results as result join private.line_delivery_attempt_starts as attempt on attempt.id=result.attempt_start_id where attempt.delivery_id='${crashClaim.delivery_id}' and result.outcome='unknown_result'`) === "1");
  pass("expired lease enters bounded retry", recovered.status === "retryable_failure" && recovered.reason === "unknown_result" && recovered.lease === null);
  run(`update private.line_notification_deliveries set next_attempt_at=clock_timestamp()-interval '1 day' where notification_id='${crashClaim.notification_id}';`);
  const retryClaim = claimOne();
  pass("recovered claim reuses retry key", retryClaim.retry_key === crashRetryKey && retryClaim.attempt_number === 2);
  finalize(retryClaim, { status: "200" });

  const maxClaim1 = claimOne();
  let maxNotification = maxClaim1.notification_id;
  finalize(maxClaim1, { kind: "network" });
  for (let attempt = 2; attempt <= 4; attempt += 1) {
    run(`update private.line_notification_deliveries set next_attempt_at=clock_timestamp()-interval '1 day' where notification_id='${maxNotification}';`);
    const claim = claimOne();
    const result = finalize(claim, { kind: "network" });
    if (attempt < 4) pass(`attempt ${attempt} remains bounded retry`, result.status === "retryable_failure");
    else pass("attempt 4 exhausts retry budget", result.status === "terminal_failure" && result.reason === "retry_exhausted");
  }

  const deadlineClaim = claimOne();
  run(`update private.line_notification_deliveries set first_attempt_at=clock_timestamp()-interval '22 hours 59 minutes 30 seconds' where id='${deadlineClaim.delivery_id}';`);
  const deadline = finalize(deadlineClaim, { status: "503" });
  pass("retry crossing 23-hour boundary is terminal", deadline.status === "terminal_failure" && deadline.reason === "retry_exhausted");

  const cancelClaim = run(`select row_to_json(claim)::text from private.claim_line_deliveries(100) as claim`).split(/\r?\n/).map((line) => JSON.parse(line)).find((claim) => claim.line_user_id === "Uffffffffffffffffffffffffffffffff");
  assert.ok(cancelClaim);
  run(`update private.worker_line_links set external_reminders_enabled=false,enabled_at=null,updated_at=clock_timestamp() where profile_id='${workerB}';`);
  pass("consent cancellation terminalizes leased delivery", delivery(cancelClaim.notification_id).reason === "delivery_disabled");
  pass("old lease cannot revive terminal delivery", finalize(cancelClaim, { status: "200" }).code === "STALE_LEASE");

  pass("runtime roles cannot execute claim", ["anon", "authenticated", "service_role"].every((role) => run(`select has_function_privilege('${role}','private.claim_line_deliveries(integer)','EXECUTE');`) === "f"));
  pass("runtime roles cannot execute finalize", ["anon", "authenticated", "service_role"].every((role) => run(`select has_function_privilege('${role}','private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text)','EXECUTE');`) === "f"));
  pass("attempt evidence stores no secret payload columns", run("select count(*) from information_schema.columns where table_schema='private' and table_name in ('line_delivery_attempt_starts','line_delivery_attempt_results') and column_name in ('line_user_id','access_token','refresh_token','id_token','title','summary','response_body');") === "0");
} finally {
  cleanup();
}

pass("dedicated C2-03 fixtures cleaned", run(`select (select count(*) from private.line_notification_deliveries where notification_id::text like 'c2030000-0000-4000-8000-%')+(select count(*) from public.in_app_notifications where id::text like 'c2030000-0000-4000-8000-%');`) === "0");
console.log(`Worker LINE delivery claim/finalize: PASS (${passed} assertions)`);
