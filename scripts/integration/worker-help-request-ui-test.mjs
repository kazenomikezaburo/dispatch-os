import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OPERATIONAL_INCIDENT_CATEGORIES, currentWorkerIncident, incidentCategoryLabels, incidentStateLabels, terminalWorkerIncidents, workerIncidentError } from "../../lib/worker/incidents/worker-incident-ui.ts";

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`PASS ${name}`); }
const base = { assignmentId: "97000000-0000-0000-0002-000000000001", category: "site_access", message: "入口が分かりません", idempotencyKey: "97000000-0000-0000-0003-000000000001" };
const incident = (state, createdAt) => ({ id: `${state}-${createdAt}`, assignmentId: base.assignmentId, category: "other", message: null, state, version: 1, createdAt, acknowledgedAt: null, resolvedAt: null, retractedAt: null });

test("five exact categories", () => assert.deepEqual(OPERATIONAL_INCIDENT_CATEGORIES, ["site_access", "assignment_instruction", "schedule_transport", "health_safety", "other"]));
test("five worker category labels", () => assert.deepEqual(Object.values(incidentCategoryLabels), ["現場・集合場所", "配置・業務指示", "時間・移動", "体調・安全", "その他"]));
test("four visible state labels", () => assert.deepEqual(Object.values(incidentStateLabels), ["管理者の確認待ち", "対応中", "解決済み", "取り下げ済み"]));
const incidents = [incident("resolved", "2026-09-09T03:00:00Z"), incident("open", "2026-09-09T02:00:00Z"), incident("retracted", "2026-09-09T01:00:00Z")];
test("open is current", () => assert.equal(currentWorkerIncident(incidents)?.state, "open"));
test("terminal history excludes unresolved", () => assert.deepEqual(terminalWorkerIncidents(incidents).map((item) => item.state), ["resolved", "retracted"]));
test("active conflict requests refresh", () => assert.equal(workerIncidentError("ACTIVE_INCIDENT_EXISTS", "create").refresh, true));
test("version conflict requests refresh", () => assert.equal(workerIncidentError("VERSION_CONFLICT", "retract").refresh, true));
test("raw SQL error is hidden", () => assert.equal(workerIncidentError("23505 operational_incidents_assignment_unresolved_idx", "create").message.includes("23505"), false));
const action = await readFile(new URL("../../app/actions/operational-incidents.ts", import.meta.url), "utf8");
const readModel = await readFile(new URL("../../lib/worker/incidents/get-worker-incidents.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../../lib/worker/incidents/operational-incident-schema.ts", import.meta.url), "utf8");
test("message is optional and capped at 500", () => { assert.match(schema, /message: z\.string\(\)\.max\(500\)\.optional\(\)/); });
test("retract version is positive integer", () => { assert.match(schema, /expectedVersion: z\.number\(\)\.int\(\)\.min\(1\)/); });
test("category schema uses exact shared contract", () => assert.match(schema, /z\.enum\(OPERATIONAL_INCIDENT_CATEGORIES\)/));
test("create uses RPC", () => assert.match(action, /\.rpc\("create_operational_incident"/));
test("retract uses RPC", () => assert.match(action, /\.rpc\("retract_operational_incident"/));
test("actions contain no direct DML", () => assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(/));
test("actions accept no actor or branch input", () => assert.doesNotMatch(action, /workerId|profileId|branchId/));
test("read model uses root table", () => assert.match(readModel, /\.from\("operational_incidents"\)/));
test("read model does not query events", () => assert.doesNotMatch(readModel, /operational_incident_events/));
test("read model batches assignment ids", () => assert.match(readModel, /\.in\("assignment_id", assignmentIds\)/));
console.log(`\nWorker Help Request UI rules: ${passed}/${passed} passed`);
