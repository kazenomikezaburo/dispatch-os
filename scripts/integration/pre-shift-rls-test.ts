import { execFileSync } from "node:child_process";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { IDS } from "./test-data.ts";

type Result = { id: string; passed: boolean; actual: string };

const config = readLocalConfig();
await prepareAuthFixtures(config);
const clients = await createActorClients(config);
const results: Result[] = [];
const record = (id: string, passed: boolean, actual: string) => {
  results.push({ id, passed, actual });
  console.log(`${id} ${passed ? "PASS" : "FAIL"}: ${actual}`);
};
const id = () => crypto.randomUUID();
const fixtureIds = Array.from({ length: 5 }, () => ({ shift: id(), assignment: id() }));
const sql = fixtureIds.map(({ shift, assignment }, index) => `
  insert into public.shift_slots
    (id, job_id, starts_at, ends_at, required_workers, status)
  values
    ('${shift}', '${IDS.jobs.n1}', now() + interval '${index + 2} days',
     now() + interval '${index + 2} days 8 hours', 1, 'confirmed');
  insert into public.assignments
    (id, shift_slot_id, worker_id, source, status)
  values
    ('${assignment}', '${shift}', '${index === 1 ? IDS.workers.workerB : IDS.workers.workerA}',
     'manager', 'assigned');
`).join("\n");
execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  stdio: ["pipe", "ignore", "pipe"],
});

const ownInsert = await clients.workerA.from("pre_shift_confirmations").insert({
  assignment_id: fixtureIds[0].assignment, can_work: true, health_status: "good",
}).select("id").single();
record("PRE-SHIFT-RLS-001", !ownInsert.error && Boolean(ownInsert.data), ownInsert.error?.code ?? "inserted");

const otherInsert = await clients.workerA.from("pre_shift_confirmations").insert({
  assignment_id: fixtureIds[1].assignment, can_work: true, health_status: "good",
});
record("PRE-SHIFT-RLS-002", Boolean(otherInsert.error), otherInsert.error?.code ?? "unexpected allow");

const managerInsert = await clients.managerA.from("pre_shift_confirmations").insert({
  assignment_id: fixtureIds[2].assignment, can_work: true, health_status: "good",
});
record("PRE-SHIFT-RLS-003", Boolean(managerInsert.error), managerInsert.error?.code ?? "unexpected allow");

const adminInsert = await clients.systemAdmin.from("pre_shift_confirmations").insert({
  assignment_id: fixtureIds[3].assignment, can_work: true, health_status: "good",
});
record("PRE-SHIFT-RLS-004", Boolean(adminInsert.error), adminInsert.error?.code ?? "unexpected allow");

const anonInsert = await clients.anon.from("pre_shift_confirmations").insert({
  assignment_id: fixtureIds[4].assignment, can_work: true, health_status: "good",
});
record("PRE-SHIFT-RLS-005", Boolean(anonInsert.error), anonInsert.error?.code ?? "unexpected allow");

const workerOwn = await clients.workerA.from("pre_shift_confirmations").select("id").eq("id", ownInsert.data?.id ?? "");
record("PRE-SHIFT-RLS-006", !workerOwn.error && workerOwn.data?.length === 1, `rows=${workerOwn.data?.length ?? 0}`);
const workerOther = await clients.workerA.from("pre_shift_confirmations").select("id").eq("id", IDS.confirmations.workerB);
record("PRE-SHIFT-RLS-007", !workerOther.error && workerOther.data?.length === 0, `rows=${workerOther.data?.length ?? 0}`);
const managerOwnBranch = await clients.managerA.from("pre_shift_confirmations").select("id").eq("id", IDS.confirmations.workerB);
record("PRE-SHIFT-RLS-008", !managerOwnBranch.error && managerOwnBranch.data?.length === 1, `rows=${managerOwnBranch.data?.length ?? 0}`);
const managerOtherBranch = await clients.managerA.from("pre_shift_confirmations").select("id").eq("id", IDS.confirmations.workerC);
record("PRE-SHIFT-RLS-009", !managerOtherBranch.error && managerOtherBranch.data?.length === 0, `rows=${managerOtherBranch.data?.length ?? 0}`);
const adminSelect = await clients.systemAdmin.from("pre_shift_confirmations").select("id").eq("id", IDS.confirmations.workerC);
record("PRE-SHIFT-RLS-010", !adminSelect.error && adminSelect.data?.length === 1, `rows=${adminSelect.data?.length ?? 0}`);

async function updateRejected(client: typeof clients.workerA, confirmationId: string) {
  const response = await client.from("pre_shift_confirmations").update({ comment: "forbidden" }).eq("id", confirmationId).select("id");
  return { passed: Boolean(response.error) || response.data?.length === 0, actual: response.error?.code ?? `rows=${response.data?.length ?? 0}` };
}
async function deleteRejected(client: typeof clients.workerA, confirmationId: string) {
  const response = await client.from("pre_shift_confirmations").delete().eq("id", confirmationId).select("id");
  return { passed: Boolean(response.error) || response.data?.length === 0, actual: response.error?.code ?? `rows=${response.data?.length ?? 0}` };
}

const workerUpdate = await updateRejected(clients.workerA, ownInsert.data?.id ?? "");
record("PRE-SHIFT-RLS-011", workerUpdate.passed, workerUpdate.actual);
const managerUpdate = await updateRejected(clients.managerA, IDS.confirmations.workerB);
record("PRE-SHIFT-RLS-012", managerUpdate.passed, managerUpdate.actual);
const adminUpdate = await updateRejected(clients.systemAdmin, IDS.confirmations.workerC);
record("PRE-SHIFT-RLS-013", adminUpdate.passed, adminUpdate.actual);
const workerDelete = await deleteRejected(clients.workerA, ownInsert.data?.id ?? "");
record("PRE-SHIFT-RLS-014", workerDelete.passed, workerDelete.actual);
const managerDelete = await deleteRejected(clients.managerA, IDS.confirmations.workerB);
record("PRE-SHIFT-RLS-015", managerDelete.passed, managerDelete.actual);
const adminDelete = await deleteRejected(clients.systemAdmin, IDS.confirmations.workerC);
record("PRE-SHIFT-RLS-016", adminDelete.passed, adminDelete.actual);

const passed = results.filter((result) => result.passed).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
