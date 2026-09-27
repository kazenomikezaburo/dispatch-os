import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const action = read("app/actions/worker-journey.ts");
const button = read("components/worker/worker-journey-action-button.tsx");
const timeline = read("components/worker/worker-shift-timeline.tsx");
const home = read("app/worker/page.tsx");
const reader = read("lib/worker/get-worker-assignment.ts");
let passed = 0;
const pass = (name, condition) => { assert.ok(condition, name); passed += 1; console.log(`PASS ${name}`); };

pass("Server Action accepts only canonical input schema", /workerJourneyActionSchema\.safeParse\(input\)/.test(action) && !/workerId|occurredAt|plannedAt/.test(action));
pass("Server Action reuses canonical journey RPC", /record_own_assignment_journey_event/.test(action));
pass("Server Action authenticates Worker", /await requireWorker\(\)/.test(action));
pass("controlled outcomes have Worker-safe mappings", ["ALREADY_RECORDED", "NOT_OPEN", "NOT_REQUIRED", "SUPERSEDED", "CLOSED", "NOT_FOUND", "IDEMPOTENCY_CONFLICT"].every((code) => action.includes(code)));
pass("success revalidates Home and detail", /revalidatePath\("\/worker"\)/.test(action) && /revalidatePath\(`\/worker\/assignments/.test(action));
pass("CTA retains idempotency key for unknown result", /if \(!next\.retryable\) idempotencyKey\.current = null/.test(button));
pass("CTA prevents double submit and exposes pending feedback", /disabled=\{pending\}/.test(button) && /記録中/.test(button));
pass("CTA labels are frozen", ["起きました", "出発しました", "到着しました"].every((label) => button.includes(label)));
pass("Timeline renders CTA only from canonical nextAction", /timeline\.nextAction/.test(timeline) && /WorkerJourneyActionButton/.test(timeline));
pass("Home direct CTA is limited to the primary Assignment", /primary && journeyType/.test(home) && /WorkerJourneyActionButton/.test(home));
pass("My Shifts groups canonical lifecycle states", ["これからの勤務", "完了・過去の勤務", "取消・終了した勤務"].every((label) => home.includes(label)));
pass("My Shifts read is bounded for journey projection", /\.limit\(50\)/.test(reader));
pass("Journey UI never calls Attendance command", !/recordWorkerStartWork|record_worker_start_work/.test(button + timeline));

console.log(`Worker Journey Experience final: ${passed}/${passed} passed`);
