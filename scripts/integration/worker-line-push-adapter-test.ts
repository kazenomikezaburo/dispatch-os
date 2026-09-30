import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runLineDeliveryBatchCore } from "../../lib/line/dispatcher-core";
import type { LineDeliveryClaim, LineDeliveryStore } from "../../lib/line/delivery-db";
import { buildLinePushText, sendLinePush, type LinePushResult } from "../../lib/line/push-core";

const config = {
  appOrigin: "https://opscue.example",
  channelAccessToken: "messaging-channel-access-token-for-test",
};
const claim: LineDeliveryClaim = {
  delivery_id: "c2040000-0000-4000-8000-000000000001",
  notification_id: "c2040000-0000-4000-8000-000000000002",
  lease_token: "c2040000-0000-4000-8000-000000000003",
  retry_key: "c2040000-0000-4000-8000-000000000004",
  attempt_number: 1,
  line_user_id: "Ueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  notification_title: "出発時刻が近づいています",
  notification_summary: "勤務詳細を確認し、準備ができたら出発を記録してください。",
};
let passed = 0;

function pass(name: string, condition: unknown) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function response(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers });
}

async function mockResult(status: number, headers: Record<string, string> = {}) {
  return sendLinePush(config, {
    notificationId: claim.notification_id,
    lineUserId: claim.line_user_id,
    retryKey: claim.retry_key,
    title: claim.notification_title,
    summary: claim.notification_summary,
  }, { fetcher: async () => response(status, headers) });
}

async function main() {
const text = buildLinePushText(config, {
  notificationId: claim.notification_id,
  lineUserId: claim.line_user_id,
  retryKey: claim.retry_key,
  title: claim.notification_title,
  summary: claim.notification_summary,
});
pass("message contains only controlled title summary and safe URL", text === `${claim.notification_title}\n${claim.notification_summary}\nhttps://opscue.example/worker/notifications/${claim.notification_id}`);

let capturedAuthorization = "";
let capturedRetryKey = "";
let capturedBody: unknown;
const first = await sendLinePush(config, {
  notificationId: claim.notification_id,
  lineUserId: claim.line_user_id,
  retryKey: claim.retry_key,
  title: claim.notification_title,
  summary: claim.notification_summary,
}, {
  fetcher: async (_input, init) => {
    const headers = new Headers(init?.headers);
    capturedAuthorization = headers.get("authorization") ?? "";
    capturedRetryKey = headers.get("x-line-retry-key") ?? "";
    capturedBody = JSON.parse(String(init?.body));
    return response(200, { "x-line-request-id": "request-200" });
  },
});
pass("success is safely classified", first.resultKind === "http" && first.httpStatus === 200 && first.providerRequestId === "request-200");
pass("Messaging API token is server request authorization", capturedAuthorization === `Bearer ${config.channelAccessToken}`);
pass("stable retry key is sent exactly", capturedRetryKey === claim.retry_key);
pass("provider body is one text push", JSON.stringify(capturedBody) === JSON.stringify({ to: claim.line_user_id, messages: [{ type: "text", text }] }));

const confirmed409 = await mockResult(409, {
  "x-line-request-id": "retry-request",
  "x-line-accepted-request-id": "accepted-request",
});
pass("409 with accepted request ID is confirmed", confirmed409.retryKeyAccepted && confirmed409.providerRequestId === "accepted-request");
const unknown409 = await mockResult(409, { "x-line-request-id": "unknown-conflict" });
pass("409 without accepted request ID is not success", !unknown409.retryKeyAccepted && unknown409.providerRequestId === "unknown-conflict");

for (const status of [400, 401, 403, 408, 500, 503]) {
  const result = await mockResult(status, { "x-line-request-id": `request-${status}` });
  pass(`${status} remains an HTTP result for canonical finalize`, result.resultKind === "http" && result.httpStatus === status && !result.retryKeyAccepted);
}
const limited = await mockResult(429, { "retry-after": "600", "x-line-request-id": "request-429" });
pass("429 forwards bounded Retry-After", limited.httpStatus === 429 && limited.retryAfterSeconds === 600);

const timeout = await sendLinePush(config, claimToPush(claim), {
  timeoutMs: 100,
  fetcher: async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }),
});
pass("AbortController timeout is classified without provider payload", timeout.resultKind === "timeout" && timeout.httpStatus === null && timeout.providerRequestId === null);
const network = await sendLinePush(config, claimToPush(claim), { fetcher: async () => { throw new Error("controlled network failure"); } });
pass("network failure is classified without leaking error", network.resultKind === "network" && network.httpStatus === null && network.providerRequestId === null);

const sentRetryKeys: string[] = [];
const finalizedResults: LinePushResult[] = [];
let claimsRemaining = 1;
const store: LineDeliveryStore = {
  async claim(limit) {
    pass("dispatcher uses requested bounded claim", limit === 1);
    return claimsRemaining-- > 0 ? [claim] : [];
  },
  async finalize(_claim, result) {
    finalizedResults.push(result);
    return { ok: true, status: "delivered", reason: "provider_accepted" };
  },
};
const dispatched = await runLineDeliveryBatchCore(config, {
  limit: 1,
  store,
  fetcher: async (_input, init) => {
    sentRetryKeys.push(new Headers(init?.headers).get("x-line-retry-key") ?? "");
    return response(200, { "x-line-request-id": "dispatcher-request" });
  },
});
pass("one-shot dispatcher claims sends and finalizes", dispatched.claimed === 1 && dispatched.finalized === 1 && finalizedResults.length === 1);
const empty = await runLineDeliveryBatchCore(config, { limit: 1, store, fetcher: async () => { throw new Error("must not send"); } });
pass("ineligible or empty claim never calls provider", empty.claimed === 0 && empty.finalized === 0);

let crashClaims = 0;
const crashStore: LineDeliveryStore = {
  async claim() { crashClaims += 1; return [claim]; },
  async finalize() { throw new Error("simulated process crash before finalize persisted"); },
};
for (let run = 0; run < 2; run += 1) {
  await assert.rejects(() => runLineDeliveryBatchCore(config, {
    limit: 1,
    store: crashStore,
    fetcher: async (_input, init) => {
      sentRetryKeys.push(new Headers(init?.headers).get("x-line-retry-key") ?? "");
      return response(run === 0 ? 200 : 409, run === 0 ? {} : { "x-line-accepted-request-id": "accepted-after-crash" });
    },
  }));
}
pass("crash recovery reuses the same retry key", crashClaims === 2 && sentRetryKeys.every((key) => key === claim.retry_key));

const psql = (statement: string) => execFileSync("docker", [
  "exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq",
], { input: statement, encoding: "utf8" }).trim();
pass("dispatcher role can execute only claim and finalize", psql(`
  select
    has_function_privilege('opscue_line_dispatcher','private.claim_line_deliveries(integer)','EXECUTE')
    and has_function_privilege('opscue_line_dispatcher','private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text)','EXECUTE')
    and not has_table_privilege('opscue_line_dispatcher','private.line_notification_deliveries','SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('opscue_line_dispatcher','private.worker_line_links','SELECT,INSERT,UPDATE,DELETE');
`) === "t");
pass("canary dispatcher role has exact claim and finalize only", psql(`
  select
    has_function_privilege('opscue_line_canary_dispatcher','private.claim_line_delivery_canary(uuid)','EXECUTE')
    and has_function_privilege('opscue_line_canary_dispatcher','private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text)','EXECUTE')
    and not has_function_privilege('opscue_line_canary_dispatcher','private.claim_line_deliveries(integer)','EXECUTE')
    and not has_table_privilege('opscue_line_canary_dispatcher','private.line_notification_deliveries','SELECT,INSERT,UPDATE,DELETE');
`) === "t");
pass("browser roles still cannot execute delivery commands", psql(`
  select bool_and(not has_function_privilege(role_name,p.oid,'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array['public','anon','authenticated','service_role']) role_name
  where n.nspname='private' and p.proname in ('claim_line_deliveries','finalize_line_delivery');
`) === "t");

const source = [
  "../../lib/line/config.ts",
  "../../lib/line/push.ts",
  "../../lib/line/push-core.ts",
  "../../lib/line/delivery-db.ts",
  "../../lib/line/dispatcher.ts",
  "../../lib/line/dispatcher-core.ts",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const dispatcherScript = readFileSync(new URL("../line-delivery-dispatcher.ts",import.meta.url),"utf8");
pass("delivery runtime has no public Route or Server Action", !/export\s+(async\s+)?function\s+(GET|POST)|["']use server["']/.test(source));
pass("credentials are server-only and never NEXT_PUBLIC", !/NEXT_PUBLIC_/.test(source) && source.includes("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN"));
pass("delivery runtime does not log provider data", !/console\.(log|error|warn|info)|response\.(json|text)\(/.test(source));
pass("canary mode requires exact scope dedicated DB and batch one", dispatcherScript.includes("LINE_CANARY_SCOPE_ID")
  && dispatcherScript.includes("OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL")
  && source.includes("batch size must be exactly 1")
  && dispatcherScript.includes("normal and canary LINE dispatcher configuration cannot coexist"));

console.log(`Worker LINE push adapter: PASS (${passed} assertions)`);
}

void main();

function claimToPush(value: LineDeliveryClaim) {
  return {
    notificationId: value.notification_id,
    lineUserId: value.line_user_id,
    retryKey: value.retry_key,
    title: value.notification_title,
    summary: value.notification_summary,
  };
}
