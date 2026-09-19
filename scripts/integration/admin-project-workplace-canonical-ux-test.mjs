import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
import { IDS } from "./test-data.ts";

const results = [];
const check = (name, pass) => { results.push(pass); console.log(`${name} ${pass ? "PASS" : "FAIL"}`); };
const source = (path) => readFileSync(path, "utf8");
const nav = source("components/admin/admin-nav.ts");
const master = source("components/admin/masters/master-workspace-header.tsx");
const page = source("app/admin/projects/[projectId]/page.tsx");
const workspace = source("components/admin/projects/detail/project-workplace-workspace.tsx");
const editor = source("components/admin/masters/master-editor.tsx");
const action = source("app/actions/project-workplaces.ts");
const migration = source("supabase/migrations/20260914183520_project_context_workplace_update.sql");
const jobForm = source("components/admin/projects/jobs/form/job-create-form.tsx");
[
  ["UX-001", !nav.includes('href: "/admin/workplaces"')], ["UX-002", !master.includes("AdminSectionTabs")],
  ["UX-003", master.includes("勤務先・会場は案件から管理")], ["UX-004", page.includes("ProjectWorkplaceWorkspace")],
  ["UX-005", workspace.includes("jobs.map")], ["UX-006", workspace.includes("現在の勤務先・会場")],
  ["UX-007", workspace.includes("新しい勤務先・会場を登録")], ["UX-008", workspace.includes("jobId: job.id")],
  ["UX-009", editor.includes("共有マスタ")], ["UX-010", editor.includes("全業務に反映")],
  ["UX-011", editor.includes("projectContext.jobName")], ["UX-012", action.includes("update_project_context_workplace")],
  ["UX-013", action.includes("revalidatePath(`/admin/projects/")], ["UX-014", jobForm.includes('workplace_id: ""')],
  ["UX-015", migration.includes("security definer")], ["UX-016", migration.includes("set search_path = ''")],
  ["UX-017", migration.includes("private.has_branch_access")], ["UX-018", migration.includes("for update of workplace")],
  ["UX-019", migration.includes("WORKPLACE_UPDATE_CONFLICT")], ["UX-020", migration.includes("cardinality(v_changed_fields) = 0")],
  ["UX-021", migration.includes("PROJECT_CONTEXT_WORKPLACE_UPDATED")], ["UX-022", migration.includes("'workplace'")],
  ["UX-023", migration.includes("private.project_history_actor")], ["UX-024", !migration.includes("to_jsonb(v_workplace)")],
  ["UX-025", migration.includes("revoke all on function public.update_project_context_workplace")],
  ["UX-026", migration.includes("grant execute on function public.update_project_context_workplace")],
].forEach(([name, pass]) => check(name, pass));

const config = readLocalConfig();
await prepareAuthFixtures(config);
const clients = await createActorClients(config);
const ids = { project: crypto.randomUUID(), job: crypto.randomUUID(), workplace: crypto.randomUUID() };
const sql = (statement) => execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: statement, encoding: "utf8" }).trim();
const context = await clients.managerA.from("projects").select("branch_id,client_id").eq("id", IDS.projects.n1).single();
assert.ifError(context.error);
try {
  sql(`insert into public.workplaces(id,branch_id,name,address,is_active) values('${ids.workplace}','${context.data.branch_id}','6G会場','変更前',true); insert into public.projects(id,branch_id,client_id,name,start_date,end_date,status,created_by) values('${ids.project}','${context.data.branch_id}','${context.data.client_id}','6G案件','2026-11-01','2026-11-02','draft','${IDS.users.managerA}'); insert into public.jobs(id,project_id,workplace_id,name,status) values('${ids.job}','${ids.project}','${ids.workplace}','6G業務','draft');`);
  const current = await clients.managerA.from("workplaces").select("updated_at").eq("id", ids.workplace).single();
  const args = { p_project_id: ids.project, p_job_id: ids.job, p_workplace_id: ids.workplace, p_expected_updated_at: current.data.updated_at, p_name: "6G会場更新", p_postal_code: null, p_address: "変更後", p_default_transport_note: null, p_access_note: null, p_meeting_note: null, p_is_active: true };
  const updated = await clients.managerA.rpc("update_project_context_workplace", args);
  check("DB-027", !updated.error && updated.data.outcome === "updated");
  const rows = sql(`select name||'|'||address from public.workplaces where id='${ids.workplace}'`);
  check("DB-028", rows === "6G会場更新|変更後");
  const history = sql(`select count(*)||'|'||min(event_type)||'|'||min(target_type) from public.project_history_events where project_id='${ids.project}' and event_type='PROJECT_CONTEXT_WORKPLACE_UPDATED'`);
  check("DB-029", history === "1|PROJECT_CONTEXT_WORKPLACE_UPDATED|workplace");
  const noOp = await clients.managerA.rpc("update_project_context_workplace", { ...args, p_expected_updated_at: updated.data.updated_at, p_name: "6G会場更新", p_address: "変更後" });
  check("DB-030", !noOp.error && noOp.data.outcome === "no_change");
  check("DB-031", sql(`select count(*) from public.project_history_events where project_id='${ids.project}' and event_type='PROJECT_CONTEXT_WORKPLACE_UPDATED'`) === "1");
  const stale = await clients.managerA.rpc("update_project_context_workplace", args);
  check("DB-032", Boolean(stale.error));
  const worker = await clients.workerA.rpc("update_project_context_workplace", { ...args, p_expected_updated_at: updated.data.updated_at });
  check("DB-033", Boolean(worker.error));
  const foreign = await clients.managerA.rpc("update_project_context_workplace", { ...args, p_project_id: IDS.projects.t1, p_expected_updated_at: updated.data.updated_at });
  check("DB-034", Boolean(foreign.error));
  const anon = await clients.anon.rpc("update_project_context_workplace", { ...args, p_expected_updated_at: updated.data.updated_at });
  check("DB-035", Boolean(anon.error));
  check("DB-036", sql("select count(*) from pg_trigger where tgrelid='public.workplaces'::regclass and not tgisinternal") === "1");
  check("DB-037", !JSON.stringify(updated.data).includes("job"));
} finally {
  sql(`set session_replication_role=replica; delete from public.project_history_events where project_id='${ids.project}'; delete from public.jobs where id='${ids.job}'; delete from public.projects where id='${ids.project}'; delete from public.workplaces where id='${ids.workplace}'; set session_replication_role=origin;`);
}
console.log(`TOTAL=${results.length} PASSED=${results.filter(Boolean).length} FAILED=${results.filter((value) => !value).length}`);
if (results.some((value) => !value)) process.exitCode = 1;
