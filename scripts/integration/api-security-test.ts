import type { SupabaseClient } from "@supabase/supabase-js";
// @ts-ignore Node's native TypeScript loader requires the explicit .ts suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-ignore Node's native TypeScript loader requires the explicit .ts suffix.
import { ACTORS, IDS, TABLES, testUuid } from "./test-data.ts";
// @ts-ignore Node's native TypeScript loader requires the explicit .ts suffix.
import { outcome, TestRunner, type Outcome } from "./test-runner.ts";

async function selectId(client: SupabaseClient, table: string, id: string): Promise<Outcome> {
  return outcome(await client.from(table).select("id").eq("id", id));
}
async function selectAll(client: SupabaseClient, table: string): Promise<Outcome> {
  return outcome(await client.from(table).select("*"));
}
async function selectIds(client: SupabaseClient, table: string, ids: readonly string[]): Promise<Outcome> {
  return outcome(await client.from(table).select("id").in("id", ids));
}
async function insert(client: SupabaseClient, table: string, values: Record<string, unknown>): Promise<Outcome> {
  return outcome(await client.from(table).insert(values).select("*"));
}
async function update(client: SupabaseClient, table: string, id: string,
  values: Record<string, unknown>): Promise<Outcome> {
  return outcome(await client.from(table).update(values).eq("id", id).select("*"));
}
async function remove(client: SupabaseClient, table: string, id: string): Promise<Outcome> {
  return outcome(await client.from(table).delete().eq("id", id).select("*"));
}
async function removeBy(client: SupabaseClient, table: string, column: string, value: string): Promise<Outcome> {
  return outcome(await client.from(table).delete().eq(column, value).select("*"));
}

const runner = new TestRunner();
const config = readLocalConfig();
await prepareAuthFixtures(config);
const clients = await createActorClients(config);

for (const [name, fixture] of Object.entries(ACTORS)) {
  const { data, error } = await clients[name as keyof typeof ACTORS].auth.getSession();
  runner.record({ id: `API-AUTH-${name}`, category: "Authentication", actor: name,
    action: "signInWithPassword", target: fixture.email, expected: "ALLOW",
    actual: error || !data.session ? "DENY" : "ALLOW", layer: error ? "AUTH" : "NONE",
    status: error ? 401 : 200, code: error?.code ?? "", message: error?.message ?? "",
    passed: !error && data.session?.user.id === fixture.id });
}

let index = 1;
for (const table of TABLES) {
  runner.expectDenied(`API-ANON-${String(index++).padStart(3, "0")}`, "Anonymous Access",
    "anon", "SELECT", table, await selectAll(clients.anon, table), "GRANT");
}

runner.expectRows("API-RLS-WO-001", "RLS", "Worker A", "own worker", await selectId(clients.workerA, "workers", IDS.workers.workerA), 1);
runner.expectRows("API-IDOR-WO-002", "IDOR", "Worker A", "Worker B", await selectId(clients.workerA, "workers", IDS.workers.workerB), 0);
runner.expectRows("API-IDOR-WO-003", "IDOR", "Worker A", "Worker C", await selectId(clients.workerA, "workers", IDS.workers.workerC), 0);
runner.expectRows("API-RLS-PJ-001", "RLS", "Worker A", "Project N1", await selectId(clients.workerA, "projects", IDS.projects.n1), 1);
runner.expectRows("API-IDOR-PJ-002", "IDOR", "Worker A", "Project T1", await selectId(clients.workerA, "projects", IDS.projects.t1), 0);
runner.expectRows("API-RLS-PJ-003", "RLS", "Worker A", "closed Project N2", await selectId(clients.workerA, "projects", IDS.projects.n2), 1);
runner.expectRows("API-IDOR-PJ-004", "IDOR", "Worker B", "closed Project N2", await selectId(clients.workerB, "projects", IDS.projects.n2), 0);

const appSuccessId = testUuid(1);
runner.expectAllowed("API-RLS-APP-001", "RLS", "Worker A", "INSERT", "own Nagoya application",
  await insert(clients.workerA, "shift_applications", { id: appSuccessId, shift_slot_id: IDS.shifts.n1, worker_id: IDS.workers.workerA, status: "applied" }));
runner.expectDenied("API-SEC-APP-002", "Privilege Escalation", "Worker A", "INSERT", "Worker B identity",
  await insert(clients.workerA, "shift_applications", { id: testUuid(1), shift_slot_id: IDS.shifts.n1, worker_id: IDS.workers.workerB, status: "applied" }), "RLS");
runner.expectDenied("API-IDOR-APP-003", "IDOR", "Worker A", "INSERT", "Tokyo Shift UUID",
  await insert(clients.workerA, "shift_applications", { id: testUuid(1), shift_slot_id: IDS.shifts.t1, worker_id: IDS.workers.workerA, status: "applied" }), "RLS");
runner.expectDenied("API-RLS-APP-004", "RLS", "Worker A", "INSERT", "accepted status",
  await insert(clients.workerA, "shift_applications", { id: testUuid(1), shift_slot_id: IDS.shifts.n1, worker_id: IDS.workers.workerA, status: "accepted" }), "RLS");
runner.expectDenied("API-RLS-APP-005", "RLS", "Worker A", "INSERT", "closed Shift N2",
  await insert(clients.workerA, "shift_applications", { id: testUuid(1), shift_slot_id: IDS.shifts.n2, worker_id: IDS.workers.workerA, status: "applied" }), "RLS");
runner.expectDenied("API-RLS-APP-006", "RLS", "Worker A", "UPDATE", "own application",
  await update(clients.workerA, "shift_applications", appSuccessId, { cancel_reason: "TEST" }), "RLS");

runner.expectRows("API-RLS-AS-001", "RLS", "Worker A", "own assignment", await selectId(clients.workerA, "assignments", IDS.assignments.workerAN2), 1);
runner.expectRows("API-IDOR-AS-002", "IDOR", "Worker A", "Worker B assignment", await selectId(clients.workerA, "assignments", IDS.assignments.workerBN1), 0);
runner.expectDenied("API-RLS-AS-003", "RLS", "Worker A", "INSERT", "assignment",
  await insert(clients.workerA, "assignments", { id: testUuid(2), shift_slot_id: IDS.shifts.n1, worker_id: IDS.workers.workerA }), "RLS");
runner.expectDenied("API-RLS-AS-004", "RLS", "Worker A", "UPDATE", "own assignment",
  await update(clients.workerA, "assignments", IDS.assignments.workerAN2, { status: "completed" }), "RLS");
runner.expectAllowed("API-RLS-AS-005", "RLS", "Manager A", "INSERT", "Nagoya assignment",
  await insert(clients.managerA, "assignments", { id: testUuid(2), shift_slot_id: IDS.shifts.n1, worker_id: IDS.workers.workerA, assigned_by: IDS.users.managerA }));
runner.expectDenied("API-IDOR-AS-006", "IDOR", "Manager A", "INSERT", "Tokyo assignment",
  await insert(clients.managerA, "assignments", { id: testUuid(2), shift_slot_id: IDS.shifts.t1, worker_id: IDS.workers.workerA, assigned_by: IDS.users.managerA }), "RLS");

const confirmationId = testUuid(3);
runner.expectAllowed("API-RLS-PSC-001", "RLS", "Worker A", "INSERT", "own future confirmation",
  await insert(clients.workerA, "pre_shift_confirmations", { id: confirmationId, assignment_id: IDS.assignments.workerAN2, can_work: true, health_status: "good" }));
runner.expectDenied("API-IDOR-PSC-002", "IDOR", "Worker A", "INSERT", "Worker B assignment",
  await insert(clients.workerA, "pre_shift_confirmations", { id: testUuid(3), assignment_id: IDS.assignments.workerBN1, can_work: true, health_status: "good" }), "RLS");
runner.expectDenied("API-RLS-PSC-003", "RLS", "Worker A", "INSERT", "past assignment",
  await insert(clients.workerA, "pre_shift_confirmations", { id: testUuid(3), assignment_id: IDS.assignments.workerAPast, can_work: true, health_status: "good" }), "RLS");
runner.expectAllowed("API-RLS-PSC-004", "RLS", "Worker A", "UPDATE", "future confirmation",
  await update(clients.workerA, "pre_shift_confirmations", confirmationId, { comment: "TEST updated" }));
runner.expectDenied("API-RLS-PSC-005", "RLS", "Worker A", "UPDATE", "past confirmation",
  await update(clients.workerA, "pre_shift_confirmations", IDS.confirmations.workerAPast, { comment: "TEST denied" }), "RLS");
runner.expectRows("API-RLS-PSC-006", "RLS", "Manager A", "Nagoya confirmation", await selectId(clients.managerA, "pre_shift_confirmations", IDS.confirmations.workerB), 1);
runner.expectAllowed("API-RLS-PSC-007", "RLS", "Manager A", "UPDATE", "Nagoya confirmation",
  await update(clients.managerA, "pre_shift_confirmations", IDS.confirmations.workerB, { comment: "TEST manager" }));
runner.expectDenied("API-IDOR-PSC-008", "IDOR", "Manager A", "UPDATE", "Tokyo confirmation",
  await update(clients.managerA, "pre_shift_confirmations", IDS.confirmations.workerC, { comment: "TEST denied" }), "RLS");

runner.expectAllowed("API-AI-AE-001", "Attendance Integrity", "Worker A", "INSERT", "own worker event",
  await insert(clients.workerA, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerAN2, event_type: "depart", source: "worker", idempotency_key: testUuid(5) }));
runner.expectDenied("API-IDOR-AE-002", "IDOR", "Worker A", "INSERT", "Worker B assignment event",
  await insert(clients.workerA, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerBN1, event_type: "depart", source: "worker", idempotency_key: testUuid(5) }), "RLS");
runner.expectDenied("API-SEC-AE-003", "Privilege Escalation", "Worker A", "INSERT", "manager source spoof",
  await insert(clients.workerA, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerAN2, event_type: "depart", source: "manager", idempotency_key: testUuid(5) }), "RLS");
runner.expectDenied("API-GRANT-AE-004", "Data API Grants", "Worker A", "UPDATE", "attendance event",
  await update(clients.workerA, "attendance_events", IDS.events.workerA, { event_type: "end_work" }), "GRANT");
runner.expectDenied("API-GRANT-AE-005", "Data API Grants", "Worker A", "DELETE", "attendance event",
  await remove(clients.workerA, "attendance_events", IDS.events.workerA), "GRANT");
runner.expectAllowed("API-AI-AE-006", "Attendance Integrity", "Manager A", "INSERT", "Nagoya manager event",
  await insert(clients.managerA, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerBN1, event_type: "depart", source: "manager", idempotency_key: testUuid(5) }));
runner.expectDenied("API-AI-AE-007", "Attendance Integrity", "Manager A", "INSERT", "worker source spoof",
  await insert(clients.managerA, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerBN1, event_type: "depart", source: "worker", idempotency_key: testUuid(5) }), "RLS");
runner.expectDenied("API-IDOR-AE-008", "IDOR", "Manager A", "INSERT", "Tokyo event",
  await insert(clients.managerA, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerCT1, event_type: "depart", source: "manager", idempotency_key: testUuid(5) }), "RLS");
runner.expectAllowed("API-AI-AE-009", "Attendance Integrity", "System Admin", "INSERT", "manager source event",
  await insert(clients.systemAdmin, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerCT1, event_type: "depart", source: "manager", idempotency_key: testUuid(5) }));
runner.expectDenied("API-SEC-AE-010", "Privilege Escalation", "System Admin", "INSERT", "worker source spoof",
  await insert(clients.systemAdmin, "attendance_events", { id: testUuid(4), assignment_id: IDS.assignments.workerCT1, event_type: "depart", source: "worker", idempotency_key: testUuid(5) }), "RLS");
runner.expectDenied("API-GRANT-AE-011", "Data API Grants", "System Admin", "UPDATE", "attendance event",
  await update(clients.systemAdmin, "attendance_events", IDS.events.workerC, { event_type: "end_work" }), "GRANT");
runner.expectDenied("API-GRANT-AE-012", "Data API Grants", "System Admin", "DELETE", "attendance event",
  await remove(clients.systemAdmin, "attendance_events", IDS.events.workerC), "GRANT");

runner.expectRows("API-RLS-AR-001", "RLS", "Worker A", "own record", await selectId(clients.workerA, "attendance_records", IDS.records.workerA), 1);
runner.expectRows("API-IDOR-AR-002", "IDOR", "Worker A", "Worker B record", await selectId(clients.workerA, "attendance_records", IDS.records.workerB), 0);
runner.expectDenied("API-RLS-AR-003", "RLS", "Worker A", "INSERT", "attendance record",
  await insert(clients.workerA, "attendance_records", { id: testUuid(6), assignment_id: IDS.assignments.workerAFuture, planned_start_at: "2099-01-16T00:00:00Z", planned_end_at: "2099-01-16T09:00:00Z" }), "RLS");
runner.expectDenied("API-RLS-AR-004", "RLS", "Worker A", "UPDATE", "own record",
  await update(clients.workerA, "attendance_records", IDS.records.workerA, { worker_note: "TEST" }), "RLS");
runner.expectRows("API-RLS-AR-005", "RLS", "Manager A", "Nagoya record", await selectId(clients.managerA, "attendance_records", IDS.records.workerB), 1);
runner.expectAllowed("API-RLS-AR-006", "RLS", "Manager A", "INSERT", "Nagoya record",
  await insert(clients.managerA, "attendance_records", { id: testUuid(6), assignment_id: IDS.assignments.workerAFuture, planned_start_at: "2099-01-16T00:00:00Z", planned_end_at: "2099-01-16T09:00:00Z" }));
runner.expectAllowed("API-RLS-AR-007", "RLS", "Manager A", "UPDATE", "Nagoya record",
  await update(clients.managerA, "attendance_records", IDS.records.workerB, { status: "working" }));
runner.expectRows("API-IDOR-AR-008", "IDOR", "Manager A", "Tokyo record", await selectId(clients.managerA, "attendance_records", IDS.records.workerC), 0);
runner.expectDenied("API-IDOR-AR-009", "IDOR", "Manager A", "UPDATE", "Tokyo record",
  await update(clients.managerA, "attendance_records", IDS.records.workerC, { status: "working" }), "RLS");
runner.expectRows("API-RLS-AR-010", "RLS", "System Admin", "all seeded records",
  await selectIds(clients.systemAdmin, "attendance_records", Object.values(IDS.records)), 3);
runner.expectAllowed("API-RLS-AR-011", "RLS", "System Admin", "INSERT", "past record",
  await insert(clients.systemAdmin, "attendance_records", { id: testUuid(6), assignment_id: IDS.assignments.workerAPast, planned_start_at: "2000-01-01T00:00:00Z", planned_end_at: "2000-01-01T09:00:00Z" }));
runner.expectAllowed("API-RLS-AR-012", "RLS", "System Admin", "UPDATE", "Tokyo record",
  await update(clients.systemAdmin, "attendance_records", IDS.records.workerC, { status: "working" }));
runner.expectDenied("API-GRANT-AR-013", "Data API Grants", "System Admin", "DELETE", "attendance record",
  await remove(clients.systemAdmin, "attendance_records", IDS.records.workerC), "GRANT");

runner.expectRows("API-RLS-MGR-001", "RLS", "Manager A", "Nagoya Worker A", await selectId(clients.managerA, "workers", IDS.workers.workerA), 1);
runner.expectRows("API-IDOR-MGR-002", "IDOR", "Manager A", "Tokyo Worker C", await selectId(clients.managerA, "workers", IDS.workers.workerC), 0);
runner.expectRows("API-RLS-MGR-003", "RLS", "Manager A", "Nagoya Project", await selectId(clients.managerA, "projects", IDS.projects.n1), 1);
runner.expectRows("API-IDOR-MGR-004", "IDOR", "Manager A", "Tokyo Project", await selectId(clients.managerA, "projects", IDS.projects.t1), 0);
runner.expectDenied("API-IDOR-MGR-005", "IDOR", "Manager A", "UPDATE", "Tokyo Project",
  await update(clients.managerA, "projects", IDS.projects.t1, { name: "TEST denied" }), "RLS");
runner.expectRows("API-RLS-MGR-006", "RLS", "Manager A", "Nagoya Job", await selectId(clients.managerA, "jobs", IDS.jobs.n1), 1);
runner.expectRows("API-IDOR-MGR-007", "IDOR", "Manager A", "Tokyo Job", await selectId(clients.managerA, "jobs", IDS.jobs.t1), 0);
runner.expectAllowed("API-RLS-MGR-008", "RLS", "Manager A", "UPDATE", "Nagoya Project",
  await update(clients.managerA, "projects", IDS.projects.n1, { description: "TEST manager update" }));
runner.expectAllowed("API-RLS-MGR-009", "RLS", "Manager A", "UPDATE", "Nagoya Job",
  await update(clients.managerA, "jobs", IDS.jobs.n1, { description: "TEST manager update" }));
runner.expectDenied("API-IDOR-MGR-010", "IDOR", "Manager A", "UPDATE", "Tokyo Job",
  await update(clients.managerA, "jobs", IDS.jobs.t1, { description: "TEST denied" }), "RLS");
runner.expectAllowed("API-RLS-MGR-011", "RLS", "Manager A", "UPDATE", "Nagoya Shift",
  await update(clients.managerA, "shift_slots", IDS.shifts.n1, { label: "TEST manager update" }));
runner.expectDenied("API-IDOR-MGR-012", "IDOR", "Manager A", "UPDATE", "Tokyo Shift",
  await update(clients.managerA, "shift_slots", IDS.shifts.t1, { label: "TEST denied" }), "RLS");

runner.expectDenied("API-SEC-001", "Privilege Escalation", "Worker A", "UPDATE", "account_type",
  await update(clients.workerA, "profiles", IDS.users.workerA, { account_type: "system_admin" }), "RLS");
runner.expectDenied("API-SEC-002", "Privilege Escalation", "Worker A", "INSERT", "manager_branch_access",
  await insert(clients.workerA, "manager_branch_access", { profile_id: IDS.users.workerA, branch_id: IDS.branches.nagoya }), "RLS");
runner.expectDenied("API-SEC-003", "Privilege Escalation", "Manager A", "INSERT", "Tokyo branch access",
  await insert(clients.managerA, "manager_branch_access", { profile_id: IDS.users.managerA, branch_id: IDS.branches.tokyo }), "RLS");
runner.expectDenied("API-SEC-004", "Privilege Escalation", "Manager A", "UPDATE", "Worker A branch",
  await update(clients.managerA, "workers", IDS.workers.workerA, { branch_id: IDS.branches.tokyo }), "RLS");
runner.expectDenied("API-GRANT-PR-INSERT", "Data API Grants", "System Admin", "INSERT", "profiles",
  await insert(clients.systemAdmin, "profiles", { id: testUuid(7), display_name: "TEST", account_type: "worker" }), "GRANT");

const deleteTargets: Record<string, string> = {
  branches: IDS.branches.nagoya, profiles: IDS.users.workerA,
  manager_branch_access: IDS.users.managerA, workers: IDS.workers.workerA,
  clients: "d0000000-0000-0000-0000-000000000001", projects: IDS.projects.n1,
  workplaces: "f0000000-0000-0000-0000-000000000001", jobs: IDS.jobs.n1,
  shift_slots: IDS.shifts.n1, shift_applications: IDS.applications.workerAN2,
  assignments: IDS.assignments.workerAN2, pre_shift_confirmations: IDS.confirmations.workerB,
  attendance_events: IDS.events.workerA, attendance_records: IDS.records.workerA,
};
for (const [table, id] of Object.entries(deleteTargets)) {
  runner.expectDenied(`API-GRANT-DELETE-${table}`, "Data API Grants", "System Admin", "DELETE", table,
    table === "manager_branch_access"
      ? await removeBy(clients.systemAdmin, table, "profile_id", id)
      : await remove(clients.systemAdmin, table, id), "GRANT");
}

// Direct UUID IDOR checks not already covered by the functional cases.
runner.expectRows("API-IDOR-PR-001", "IDOR", "Worker A", "Worker B profile UUID", await selectId(clients.workerA, "profiles", IDS.users.workerB), 0);
runner.expectRows("API-IDOR-AE-002", "IDOR", "Worker A", "Worker B event UUID", await selectId(clients.workerA, "attendance_events", IDS.events.workerB), 0);
runner.expectRows("API-IDOR-PSC-003", "IDOR", "Worker A", "Worker C confirmation UUID", await selectId(clients.workerA, "pre_shift_confirmations", IDS.confirmations.workerC), 0);

runner.finish();
