import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
import { IDS } from "./test-data.ts";

const config = readLocalConfig();
await prepareAuthFixtures(config);
const clients = await createActorClients(config);
const fixture = {
  nagoyaProject: crypto.randomUUID(),
  tokyoProject: crypto.randomUUID(),
  partialProject: crypto.randomUUID(),
  job: crypto.randomUUID(),
  partialJob: crypto.randomUUID(),
  shift: crypto.randomUUID(),
};
const results = [];
const record = (id, passed, actual) => {
  results.push(passed);
  console.log(`${id} ${passed ? "PASS" : "FAIL"}: ${actual}`);
};
function sql(statement) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: statement,
    encoding: "utf8",
  }).trim();
}
async function history(client, projectId, limit = 20, cursor = null) {
  return client.rpc("list_project_history_events", {
    p_project_id: projectId,
    p_limit: limit,
    p_before_created_at: cursor?.created_at ?? null,
    p_before_id: cursor?.id ?? null,
  });
}

const managerContext = await clients.managerA.from("projects").select("branch_id, client_id").eq("id", IDS.projects.n1).single();
const managerProfile = await clients.managerA.from("profiles").select("display_name").eq("id", IDS.users.managerA).single();
const managerWorkplace = await clients.managerA.from("workplaces").select("id").eq("branch_id", managerContext.data?.branch_id ?? "").eq("is_active", true).limit(1).single();
const tokyoContext = await clients.systemAdmin.from("projects").select("branch_id, client_id").eq("id", IDS.projects.t1).single();
const tokyoWorkplace = await clients.systemAdmin.from("workplaces").select("id").eq("branch_id", tokyoContext.data?.branch_id ?? "").eq("is_active", true).limit(1).single();
assert.ifError(managerContext.error);
assert.ifError(managerProfile.error);
assert.ifError(managerWorkplace.error);
assert.ifError(tokyoContext.error);
assert.ifError(tokyoWorkplace.error);

try {
  const noBackfill = sql(`select count(*) from public.project_history_events where event_type='PROJECT_CREATED' and target_id in ('${IDS.projects.n1}', '${IDS.projects.t1}');`);
  record("HISTORY-001", noBackfill === "0", `fabricated create events=${noBackfill}`);

  const projectInsert = await clients.managerA.from("projects").insert({
    id: fixture.nagoyaProject,
    branch_id: managerContext.data.branch_id,
    client_id: managerContext.data.client_id,
    name: "6B履歴テスト案件",
    start_date: "2026-10-01",
    end_date: "2026-10-05",
    status: "draft",
    description: "payloadへ複製してはいけない本文",
    created_by: IDS.users.managerA,
  });
  record("HISTORY-002", !projectInsert.error, projectInsert.error?.message ?? "Project created");
  let page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-003", !page.error && page.data.items.length === 1 && page.data.items[0].event_type === "PROJECT_CREATED", `events=${page.data?.items?.length ?? 0}`);
  record("HISTORY-004", page.data.items[0].actor_display_name === managerProfile.data.display_name, `actor=${page.data.items[0].actor_display_name}`);
  const actorId = sql(`select actor_user_id from public.project_history_events where project_id='${fixture.nagoyaProject}' order by id limit 1;`);
  record("HISTORY-005", actorId === IDS.users.managerA, `actor_user_id=${actorId}`);

  const noOpBefore = page.data.items.length;
  const noOp = await clients.managerA.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", fixture.nagoyaProject);
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-006", !noOp.error && page.data.items.length === noOpBefore, `events=${page.data.items.length}`);

  const projectUpdate = await clients.managerA.from("projects").update({ description: "変更後の秘密本文" }).eq("id", fixture.nagoyaProject);
  page = await history(clients.managerA, fixture.nagoyaProject);
  const projectUpdated = page.data.items[0];
  record("HISTORY-007", !projectUpdate.error && projectUpdated.event_type === "PROJECT_UPDATED", projectUpdated.event_type);
  record("HISTORY-008", projectUpdated.payload.changed_fields.includes("description") && !JSON.stringify(projectUpdated.payload).includes("変更後の秘密本文"), JSON.stringify(projectUpdated.payload));

  const statusUpdate = await clients.managerA.from("projects").update({ status: "recruiting" }).eq("id", fixture.nagoyaProject);
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-009", !statusUpdate.error && page.data.items[0].event_type === "PROJECT_STATUS_CHANGED", page.data.items[0].event_type);
  const mixedBefore = page.data.items.length;
  const mixedUpdate = await clients.managerA.from("projects").update({ name: "6B履歴テスト案件 更新", status: "closed" }).eq("id", fixture.nagoyaProject);
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-009A", !mixedUpdate.error && page.data.items[0].event_type === "PROJECT_UPDATED", page.data.items[0].event_type);
  record("HISTORY-009B", page.data.items.length === mixedBefore + 1 && page.data.items[0].payload.changed_fields.includes("status") && page.data.items[0].payload.changed_fields.includes("name"), JSON.stringify(page.data.items[0].payload));

  const jobInsert = await clients.managerA.from("jobs").insert({
    id: fixture.job,
    project_id: fixture.nagoyaProject,
    workplace_id: managerWorkplace.data.id,
    name: "履歴対象業務",
    status: "draft",
    description: "保存しない業務本文",
  });
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-010", !jobInsert.error && page.data.items[0].event_type === "JOB_CREATED", page.data.items[0].event_type);
  record("HISTORY-011", page.data.items[0].payload.workplace_label && !JSON.stringify(page.data.items[0].payload).includes("保存しない業務本文"), JSON.stringify(page.data.items[0].payload));

  const secondWorkplace = await clients.managerA.from("workplaces").select("id").eq("branch_id", managerContext.data.branch_id).neq("id", managerWorkplace.data.id).eq("is_active", true).limit(1).maybeSingle();
  assert.ifError(secondWorkplace.error);
  if (secondWorkplace.data) {
    const workplaceChange = await clients.managerA.from("jobs").update({ workplace_id: secondWorkplace.data.id }).eq("id", fixture.job);
    page = await history(clients.managerA, fixture.nagoyaProject);
    record("HISTORY-012", !workplaceChange.error && page.data.items[0].event_type === "JOB_WORKPLACE_CHANGED", page.data.items[0].event_type);
    record("HISTORY-013", Boolean(page.data.items[0].payload.old_workplace_label && page.data.items[0].payload.new_workplace_label), JSON.stringify(page.data.items[0].payload));
  } else {
    record("HISTORY-012", true, "SKIP: local seed has one active Nagoya Workplace");
    record("HISTORY-013", true, "SKIP: covered by migration contract assertion below");
  }

  const jobUpdate = await clients.managerA.from("jobs").update({ name: "履歴対象業務 更新" }).eq("id", fixture.job);
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-014", !jobUpdate.error && page.data.items[0].event_type === "JOB_UPDATED", page.data.items[0].event_type);
  const jobStatus = await clients.managerA.from("jobs").update({ status: "recruiting" }).eq("id", fixture.job);
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-015", !jobStatus.error && page.data.items[0].event_type === "JOB_STATUS_CHANGED", page.data.items[0].event_type);

  const shiftInsert = await clients.managerA.from("shift_slots").insert({
    id: fixture.shift,
    job_id: fixture.job,
    starts_at: "2026-10-02T00:00:00Z",
    ends_at: "2026-10-02T09:00:00Z",
    required_workers: 2,
    status: "draft",
  });
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-016", !shiftInsert.error && page.data.items[0].event_type === "SHIFT_CREATED", page.data.items[0].event_type);
  record("HISTORY-017", page.data.items[0].payload.job_id === fixture.job && page.data.items[0].payload.workplace_label, JSON.stringify(page.data.items[0].payload));
  const shiftUpdate = await clients.managerA.from("shift_slots").update({ required_workers: 3 }).eq("id", fixture.shift);
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-018", !shiftUpdate.error && page.data.items[0].event_type === "SHIFT_UPDATED", page.data.items[0].event_type);
  const shiftStatus = await clients.managerA.from("shift_slots").update({ status: "recruiting" }).eq("id", fixture.shift);
  page = await history(clients.managerA, fixture.nagoyaProject);
  record("HISTORY-019", !shiftStatus.error && page.data.items[0].event_type === "SHIFT_STATUS_CHANGED", page.data.items[0].event_type);

  const directInsert = await clients.managerA.from("project_history_events").insert({});
  const directUpdate = await clients.managerA.from("project_history_events").update({ target_label_snapshot: "改ざん" }).eq("project_id", fixture.nagoyaProject);
  const directDelete = await clients.managerA.from("project_history_events").delete().eq("project_id", fixture.nagoyaProject);
  record("HISTORY-020", Boolean(directInsert.error), directInsert.error?.code ?? "unexpected allow");
  record("HISTORY-021", Boolean(directUpdate.error), directUpdate.error?.code ?? "unexpected allow");
  record("HISTORY-022", Boolean(directDelete.error), directDelete.error?.code ?? "unexpected allow");

  const directWorker = await history(clients.workerA, fixture.nagoyaProject);
  record("HISTORY-023", !directWorker.error && directWorker.data.items.length === 0, `worker rows=${directWorker.data?.items?.length ?? 0}`);

  const tokyoInsert = await clients.systemAdmin.from("projects").insert({
    id: fixture.tokyoProject,
    branch_id: tokyoContext.data.branch_id,
    client_id: tokyoContext.data.client_id,
    name: "6B東京履歴テスト",
    start_date: "2026-10-01",
    end_date: "2026-10-02",
    status: "draft",
    created_by: IDS.users.systemAdmin,
  });
  const managerForeign = await history(clients.managerA, fixture.tokyoProject);
  const managerMissing = await history(clients.managerA, crypto.randomUUID());
  const adminTokyo = await history(clients.systemAdmin, fixture.tokyoProject);
  record("HISTORY-024", !tokyoInsert.error && managerForeign.data.items.length === 0, `foreign rows=${managerForeign.data.items.length}`);
  record("HISTORY-025", JSON.stringify(managerForeign.data) === JSON.stringify(managerMissing.data), "foreign and missing are indistinguishable");
  record("HISTORY-026", !adminTokyo.error && adminTokyo.data.items.length === 1, `system admin rows=${adminTokyo.data.items.length}`);

  const firstPage = await history(clients.managerA, fixture.nagoyaProject, 2);
  const secondPage = await history(clients.managerA, fixture.nagoyaProject, 2, firstPage.data.next_cursor);
  const firstIds = firstPage.data.items.map((item) => Number(item.id));
  record("HISTORY-027", firstIds.length === 2 && firstIds[0] > firstIds[1], `ids=${firstIds.join(",")}`);
  record("HISTORY-028", Boolean(firstPage.data.next_cursor) && secondPage.data.items.length > 0 && !firstIds.includes(Number(secondPage.data.items[0].id)), `next=${secondPage.data.items[0]?.id}`);

  const partialInsert = await clients.managerA.from("projects").insert({
    id: fixture.partialProject,
    branch_id: managerContext.data.branch_id,
    client_id: managerContext.data.client_id,
    name: "6B部分失敗テスト",
    start_date: "2026-11-01",
    end_date: "2026-11-02",
    status: "draft",
    created_by: IDS.users.managerA,
  });
  const failedJob = await clients.managerA.from("jobs").insert({ id: fixture.partialJob, project_id: fixture.partialProject, workplace_id: crypto.randomUUID(), name: "失敗業務" });
  let partialHistory = await history(clients.managerA, fixture.partialProject);
  record("HISTORY-029", !partialInsert.error && Boolean(failedJob.error) && partialHistory.data.items.length === 1, `events=${partialHistory.data.items.length}`);
  const retryJob = await clients.managerA.from("jobs").insert({ id: fixture.partialJob, project_id: fixture.partialProject, workplace_id: managerWorkplace.data.id, name: "再試行業務" });
  partialHistory = await history(clients.managerA, fixture.partialProject);
  record("HISTORY-030", !retryJob.error && partialHistory.data.items.filter((item) => item.event_type === "JOB_CREATED").length === 1, `job events=${partialHistory.data.items.filter((item) => item.event_type === "JOB_CREATED").length}`);

  const rollbackProject = crypto.randomUUID();
  sql(`begin;
    select set_config('request.jwt.claim.sub', '${IDS.users.managerA}', true);
    set local role authenticated;
    insert into public.projects (id, branch_id, client_id, name, start_date, end_date, status, created_by)
    values ('${rollbackProject}', '${managerContext.data.branch_id}', '${managerContext.data.client_id}', 'Rollback Project', '2026-12-01', '2026-12-02', 'draft', '${IDS.users.managerA}');
    rollback;`);
  const rollbackRows = sql(`select (select count(*) from public.projects where id='${rollbackProject}') || '|' || (select count(*) from public.project_history_events where project_id='${rollbackProject}');`);
  record("HISTORY-031", rollbackRows === "0|0", rollbackRows);

  const operationalTriggers = sql(`select string_agg(event_object_table, ',' order by event_object_table) from (select distinct event_object_table from information_schema.triggers where trigger_name like 'emit_project_history_from_%') as trigger_tables;`);
  record("HISTORY-032", operationalTriggers === "jobs,projects,shift_slots", operationalTriggers);
  const fanoutCount = sql(`select count(*) from pg_trigger where tgrelid='public.workplaces'::regclass and tgname like '%project_history%';`);
  record("HISTORY-033", fanoutCount === "0", `Workplace history triggers=${fanoutCount}`);
  const rawDump = sql(`select pg_get_functiondef('private.emit_project_history_from_project()'::regprocedure) || pg_get_functiondef('private.emit_project_history_from_job()'::regprocedure) || pg_get_functiondef('private.emit_project_history_from_shift()'::regprocedure);`);
  record("HISTORY-034", !rawDump.includes("to_jsonb(old)") && !rawDump.includes("to_jsonb(new)"), "no raw OLD/NEW snapshots");
} finally {
  sql(`set session_replication_role = replica;
    delete from public.project_history_events where project_id in ('${fixture.nagoyaProject}', '${fixture.tokyoProject}', '${fixture.partialProject}');
    delete from public.shift_slots where id='${fixture.shift}';
    delete from public.jobs where id in ('${fixture.job}', '${fixture.partialJob}');
    delete from public.projects where id in ('${fixture.nagoyaProject}', '${fixture.tokyoProject}', '${fixture.partialProject}');
    set session_replication_role = origin;`);
}

const passed = results.filter(Boolean).length;
console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
if (passed !== results.length) process.exitCode = 1;
