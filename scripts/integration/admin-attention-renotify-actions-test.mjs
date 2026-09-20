import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const action = await readFile(new URL("../../app/actions/attention-reminders.ts", import.meta.url), "utf8");
const queue = await readFile(new URL("../../components/admin/attention/attention-queue.tsx", import.meta.url), "utf8");
let passed = 0;
function test(name, check) { check(); passed += 1; console.log(`PASS ${name}`); }

test("single action calls the frozen narrow RPC", () => assert.match(action, /rpc\("send_pre_confirmation_reminder"/));
test("bulk action calls the frozen bounded RPC", () => assert.match(action, /rpc\("send_pre_confirmation_reminders"/));
test("bulk input is bounded to 50", () => { assert.match(action, /\.max\(50\)/); assert.match(queue, /targets\.length>50/); });
test("Server Action accepts no recipient Worker or Branch", () => { assert.doesNotMatch(action, /recipientId|workerId|branchId/); assert.match(action, /assignmentIds/); });
test("Server Action reauthenticates Admin", () => assert.match(action, /await requireAdmin\(\)/));
test("only pre-confirmation Attention exposes selection", () => assert.match(queue, /item\.type==="pre_confirmation_overdue"&&item\.assignmentId/));
test("only pre-confirmation Attention exposes re-notify", () => assert.match(queue, /item\.type==="pre_confirmation_overdue"&&<button/));
test("one idempotency key is retained for an uncertain action", () => { assert.match(queue, /operation\.current\?\.snapshot!==snapshot/); assert.match(queue, /crypto\.randomUUID\(\)/); });
test("pending state blocks double submit", () => { assert.match(queue, /if\(pending\|\|targets\.length===0/); assert.match(queue, /disabled=\{pending/); });
test("selection preview is explicitly a candidate count", () => assert.match(queue, /通知候補 \{selected\.size\}名/));
test("result feedback covers every frozen per-target outcome", () => ["projected", "not_eligible", "no_recipient", "inactive_recipient", "rate_limited", "unavailable"].forEach((outcome) => assert.match(queue, new RegExp(`${outcome}:`))));
test("feedback does not claim external delivery", () => assert.match(queue, /外部配信の完了を示すものではありません/));
test("successful action revalidates Attention and Worker Inbox", () => { assert.match(action, /revalidatePath\("\/admin\/attention"\)/); assert.match(action, /revalidatePath\("\/worker\/notifications"\)/); });
test("Attention is never manually completed", () => { assert.doesNotMatch(action, /completeAttention|dismissAttention|attention.*insert/i); assert.doesNotMatch(queue, /完了にする|対応済みにする/); });

console.log(`Admin Attention Re-notify Actions: ${passed}/${passed} passed`);
