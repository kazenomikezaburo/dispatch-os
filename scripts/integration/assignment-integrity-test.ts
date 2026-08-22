import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit .ts suffix.
import { IDS } from "./test-data.ts";

const config = readLocalConfig();
const service = createClient(config.url, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
let db: SupabaseClient = service;

type Result = { id: string; pass: boolean; actual: string };
const results: Result[] = [];
const record = (id: string, pass: boolean, actual: string) => {
  results.push({ id, pass, actual });
  console.log(`${id} ${pass ? "PASS" : "FAIL"}: ${actual}`);
};
const uid = () => crypto.randomUUID();

function sql(value: string) {
  execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
    input: value,
    stdio: ["pipe", "ignore", "pipe"],
  });
}

async function shift(requiredWorkers = 1, jobId: string = IDS.jobs.n1) {
  const id = uid();
  sql(`insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status)
    values ('${id}', '${jobId}', '2035-01-01T01:00:00Z', '2035-01-01T09:00:00Z', ${requiredWorkers}, 'recruiting');`);
  return id;
}

async function application(shiftId: string, workerId: string, status = "accepted") {
  const id = uid();
  sql(`insert into public.shift_applications (id, shift_slot_id, worker_id, status)
    values ('${id}', '${shiftId}', '${workerId}', '${status}');`);
  return id;
}

async function assignment(shiftId: string, workerId: string, status: string) {
  sql(`insert into public.assignments (id, shift_slot_id, worker_id, source, status, assigned_by)
    values ('${uid()}', '${shiftId}', '${workerId}', 'manager', '${status}', '${IDS.users.managerA}');`);
}

async function rpc(client: SupabaseClient, shiftId: string, applicationId: string) {
  return client.rpc("create_assignment_from_application", {
    p_shift_id: shiftId,
    p_application_id: applicationId,
  });
}

async function extraWorker(index: number) {
  const workerId = uid();
  sql(`insert into public.workers (id, auth_profile_id, branch_id, staff_code, display_name, status)
    values ('${workerId}', null, '${IDS.branches.nagoya}', 'ASSIGN-${index}', 'Assignment Test ${index}', 'active');`);
  return workerId;
}

await prepareAuthFixtures(config);
const clients = await createActorClients(config);
db = clients.systemAdmin;
const extra = [await extraWorker(1), await extraWorker(2), await extraWorker(3)];

const s001 = await shift();
const a001 = await application(s001, IDS.workers.workerA);
const r001 = await rpc(clients.managerA, s001, a001);
record("ASSIGN-INTEGRITY-001", !r001.error && typeof r001.data === "string", r001.error?.message ?? `assignment=${r001.data}`);

const s002 = await shift();
const a002 = await application(s002, IDS.workers.workerA);
const r002 = await rpc(clients.systemAdmin, s002, a002);
record("ASSIGN-INTEGRITY-002", !r002.error, r002.error?.message ?? `assignment=${r002.data}`);

const s003 = await shift();
const a003 = await application(s003, IDS.workers.workerA);
const r003 = await rpc(clients.workerA, s003, a003);
record("ASSIGN-INTEGRITY-003", Boolean(r003.error), r003.error?.message ?? "unexpected success");
const r004 = await rpc(clients.anon, s003, a003);
record("ASSIGN-INTEGRITY-004", Boolean(r004.error), r004.error?.message ?? "unexpected success");

const s005 = await shift(1, IDS.jobs.t1);
const a005 = await application(s005, IDS.workers.workerC);
const r005 = await rpc(clients.managerA, s005, a005);
record("ASSIGN-INTEGRITY-005", Boolean(r005.error), r005.error?.message ?? "unexpected success");

for (const [number, status] of [["006", "applied"], ["007", "rejected"], ["008", "withdrawn"]] as const) {
  const s = await shift();
  const a = await application(s, IDS.workers.workerA, status);
  const r = await rpc(clients.managerA, s, a);
  record(`ASSIGN-INTEGRITY-${number}`, Boolean(r.error), r.error?.message ?? "unexpected success");
}

const s009 = await shift();
const a009 = await application(s009, IDS.workers.workerA);
const r009 = await rpc(clients.managerA, s009, a009);
record("ASSIGN-INTEGRITY-009", !r009.error, r009.error?.message ?? `assignment=${r009.data}`);

const s010 = await shift(2);
await assignment(s010, IDS.workers.workerA, "assigned");
const a010 = await application(s010, IDS.workers.workerA);
const r010 = await rpc(clients.managerA, s010, a010);
record("ASSIGN-INTEGRITY-010", Boolean(r010.error), r010.error?.message ?? "unexpected success");

for (const [number, status] of [["011", "cancelled_by_worker"], ["012", "cancelled_by_company"]] as const) {
  const s = await shift();
  await assignment(s, IDS.workers.workerA, status);
  const a = await application(s, IDS.workers.workerA);
  const r = await rpc(clients.managerA, s, a);
  const rows = await db.from("assignments").select("status").eq("shift_slot_id", s).eq("worker_id", IDS.workers.workerA);
  const statuses = rows.data?.map((row) => row.status).sort().join(",") ?? "";
  record(`ASSIGN-INTEGRITY-${number}`, !r.error && statuses.includes(status) && statuses.includes("assigned"), r.error?.message ?? statuses);
}

const s013 = await shift(2);
await assignment(s013, IDS.workers.workerA, "completed");
const a013 = await application(s013, IDS.workers.workerA);
const r013 = await rpc(clients.managerA, s013, a013);
record("ASSIGN-INTEGRITY-013", Boolean(r013.error), r013.error?.message ?? "unexpected success");

const s014 = await shift(4);
await assignment(s014, IDS.workers.workerA, "assigned");
await assignment(s014, IDS.workers.workerB, "confirmed");
await assignment(s014, IDS.workers.workerC, "completed");
const a014 = await application(s014, extra[0]);
const r014 = await rpc(clients.managerA, s014, a014);
record("ASSIGN-INTEGRITY-014", !r014.error, r014.error?.message ?? `assignment=${r014.data}`);

const s015 = await shift(4);
for (const [worker, status] of [[IDS.workers.workerA, "assigned"], [IDS.workers.workerB, "confirmed"], [IDS.workers.workerC, "completed"], [extra[0], "assigned"]] as const) {
  await assignment(s015, worker, status);
}
const a015 = await application(s015, extra[1]);
const r015 = await rpc(clients.managerA, s015, a015);
record("ASSIGN-INTEGRITY-015", Boolean(r015.error), r015.error?.message ?? "unexpected success");

const s016 = await shift(1);
const a016a = await application(s016, IDS.workers.workerA);
const a016b = await application(s016, IDS.workers.workerB);
const concurrent = await Promise.all([rpc(clients.managerA, s016, a016a), rpc(clients.managerA, s016, a016b)]);
const successes = concurrent.filter((item) => !item.error).length;
const failures = concurrent.filter((item) => item.error).length;
record("ASSIGN-INTEGRITY-016", successes === 1 && failures === 1, `success=${successes}, failure=${failures}`);
const activeAfter = await db.from("assignments").select("id", { count: "exact", head: true }).eq("shift_slot_id", s016).in("status", ["assigned", "confirmed", "completed"]);
record("ASSIGN-INTEGRITY-017", activeAfter.count === 1, `active=${activeAfter.count}, required=1`);

const appAfter = await db.from("shift_applications").select("status").eq("id", a001).single();
record("ASSIGN-INTEGRITY-018", appAfter.data?.status === "accepted", `status=${appAfter.data?.status}`);
const assignmentAfter = await db.from("assignments").select("assigned_by, source, status").eq("id", r001.data as string).single();
record("ASSIGN-INTEGRITY-019", assignmentAfter.data?.assigned_by === IDS.users.managerA, `assigned_by=${assignmentAfter.data?.assigned_by}`);
record("ASSIGN-INTEGRITY-020", assignmentAfter.data?.source === "application", `source=${assignmentAfter.data?.source}`);
record("ASSIGN-INTEGRITY-021", assignmentAfter.data?.status === "assigned", `status=${assignmentAfter.data?.status}`);

const r022 = await rpc(clients.managerA, s001, a001);
record("ASSIGN-INTEGRITY-022", Boolean(r022.error), r022.error?.message ?? "unexpected success");
const s023 = await shift();
const r023 = await rpc(clients.managerA, s023, a003);
record("ASSIGN-INTEGRITY-023", Boolean(r023.error), r023.error?.message ?? "unexpected success");
const r024 = await rpc(clients.managerA, uid(), a003);
record("ASSIGN-INTEGRITY-024", Boolean(r024.error), r024.error?.message ?? "unexpected success");
const r025 = await rpc(clients.managerA, s003, uid());
record("ASSIGN-INTEGRITY-025", Boolean(r025.error), r025.error?.message ?? "unexpected success");

const passed = results.filter((result) => result.pass).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
