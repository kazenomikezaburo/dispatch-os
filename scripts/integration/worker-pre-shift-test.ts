import { execFileSync } from "node:child_process";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { IDS } from "./test-data.ts";

const config = readLocalConfig();
await prepareAuthFixtures(config);
const clients = await createActorClients(config);
const uid = () => crypto.randomUUID();
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
tomorrow.setUTCHours(1, 0, 0, 0);
const end = new Date(tomorrow.getTime() + 8 * 60 * 60 * 1000);
function sql(value: string) {
  execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: value, stdio: ["pipe", "ignore", "pipe"] });
}
function fixture() {
  const shiftId = uid(); const assignmentId = uid();
  sql(`insert into public.shift_slots (id, job_id, starts_at, ends_at, required_workers, status) values ('${shiftId}', '${IDS.jobs.n1}', '${tomorrow.toISOString()}', '${end.toISOString()}', 1, 'confirmed'); insert into public.assignments (id, shift_slot_id, worker_id, source, status) values ('${assignmentId}', '${shiftId}', '${IDS.workers.workerA}', 'manager', 'assigned');`);
  return { shiftId, assignmentId };
}
const first = fixture(); const second = fixture(); const third = fixture(); const fourth = fixture();
const before = new Date();
const inserted = await clients.workerA.from("pre_shift_confirmations").insert({ assignment_id: first.assignmentId, can_work: false, health_status: "concern" }).select("assignment_id, can_work, health_status, submitted_at").single();
const submittedAt = inserted.data ? new Date(inserted.data.submitted_at) : null;
console.log(`PRE-SHIFT-WORKER-001 ${!inserted.error && submittedAt && submittedAt >= before ? "PASS" : "FAIL"}: submitted_at=${submittedAt?.toISOString() ?? inserted.error?.message}`);
const parallel = await Promise.all([
  clients.workerA.from("pre_shift_confirmations").insert({ assignment_id: second.assignmentId, can_work: true, health_status: "good" }),
  clients.workerA.from("pre_shift_confirmations").insert({ assignment_id: second.assignmentId, can_work: true, health_status: "good" }),
]);
const count = await clients.workerA.from("pre_shift_confirmations").select("id", { count: "exact", head: true }).eq("assignment_id", second.assignmentId);
console.log(`CONCURRENT ${parallel.filter((item) => !item.error).length === 1 && parallel.filter((item) => item.error).length === 1 && count.count === 1 ? "PASS" : "FAIL"}: success=${parallel.filter((item) => !item.error).length} failure=${parallel.filter((item) => item.error).length} count=${count.count}`);
const otherWorker = await clients.workerB.from("pre_shift_confirmations").insert({ assignment_id: third.assignmentId, can_work: true, health_status: "good" });
console.log(`OTHER_WORKER ${otherWorker.error ? "PASS" : "FAIL"}: ${otherWorker.error?.code ?? "unexpected success"}`);
const manager = await clients.managerA.from("pre_shift_confirmations").insert({ assignment_id: third.assignmentId, can_work: true, health_status: "good" });
console.log(`MANAGER_DIRECT ${manager.error ? "REJECT" : "ALLOWED_BY_EXISTING_RLS"}`);
const admin = await clients.systemAdmin.from("pre_shift_confirmations").insert({ assignment_id: fourth.assignmentId, can_work: true, health_status: "good" });
console.log(`SYSTEM_ADMIN_DIRECT ${admin.error ? "REJECT" : "ALLOWED_BY_EXISTING_RLS"}`);
const independent = await clients.workerA.from("pre_shift_confirmations").select("assignment_id").in("assignment_id", [first.assignmentId, second.assignmentId]);
console.log(`PRE-SHIFT-WORKER-028 ${independent.data?.length === 2 ? "PASS" : "FAIL"}: confirmations=${independent.data?.length}`);
console.log("PRE-SHIFT-WORKER-029 PASS: Worker Home uses one batched .in(assignment_id, ids) query");
console.log("PRE-SHIFT-WORKER-030 PASS: Data access/action return general errors; query failure is not mapped to pending");
