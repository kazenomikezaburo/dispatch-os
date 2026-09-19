import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseProjectDetailTab, projectDetailHref } from "../../components/admin/admin-detail-workflow-routes.ts";
import { encodeProjectHistoryCursor, parseProjectHistoryCursor } from "../../lib/admin/projects/project-history-cursor.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [list, detail, jobs, shifts, history, nav, create, edit, historyDal] = await Promise.all([
  read("app/admin/projects/page.tsx"),
  read("app/admin/projects/[projectId]/page.tsx"),
  read("components/admin/projects/detail/project-job-list.tsx"),
  read("components/admin/projects/detail/project-shift-section.tsx"),
  read("components/admin/projects/detail/project-history.tsx"),
  read("components/admin/admin-nav.ts"),
  read("components/admin/projects/setup/project-setup-form.tsx"),
  read("components/admin/projects/form/project-edit-page-form.tsx"),
  read("lib/admin/projects/get-project-history.ts"),
]);

assert.doesNotMatch(list, /AdminWorkflowTabs/, "Project List must not render collection workflow tabs.");
assert.match(list, /ProjectSummary/);
assert.match(list, /ProjectFilters/);
assert.match(list, /ProjectList/);
assert.equal(parseProjectDetailTab("jobs"), "overview");
assert.equal(parseProjectDetailTab("history"), "history");
assert.equal(projectDetailHref("p/1", "history"), "/admin/projects/p%2F1?tab=history");
assert.match(detail, /requestedTab === "jobs"/);
assert.match(detail, /redirect\(projectDetailHref\(project\.id\)\)/);
assert.match(detail, /label: "概要"[\s\S]*label: "シフト"[\s\S]*label: "履歴"/);
assert.doesNotMatch(detail, /label: "業務・勤務先"/);
assert.match(detail, /id="project-jobs"/);
assert.match(detail, /ProjectJobList/);
assert.doesNotMatch(detail, /ProjectOperationShortcuts|projectWorkflowHrefs/);
assert.doesNotMatch(detail, /配置・休憩|前日確認|当日運用/);
assert.match(jobs, /ProjectJobItem/);
assert.match(shifts, /\/admin\/shifts\/\$\{shift\.id\}/);
assert.doesNotMatch(shifts, /\/admin\/placement|\/admin\/pre-shift|\/admin\/day-of/);
assert.match(detail, /getProjectHistory\(project\.id/);
assert.match(historyDal, /list_project_history_events/);
assert.match(history, /projectHistorySummary/);
assert.match(history, /記録された履歴はまだありません/);
assert.match(history, /さらに読み込む/);
assert.doesNotMatch(history, /JSON\.stringify|targetId|actorUserId|actor_user_id/);
const cursor = { createdAt: "2026-09-14T06:00:00.000Z", id: 42 };
assert.deepEqual(parseProjectHistoryCursor(encodeProjectHistoryCursor(cursor)), cursor);
assert.equal(parseProjectHistoryCursor("malformed"), null);
assert.equal(parseProjectHistoryCursor(encodeProjectHistoryCursor({ createdAt: "bad", id: 42 })), null);
assert.equal(parseProjectHistoryCursor(encodeProjectHistoryCursor({ createdAt: cursor.createdAt, id: 0 })), null);
assert.match(create, /router\.push\(`\/admin\/projects\/\$\{projectId\}`\)/);
assert.match(edit, /mode="edit"/);
assert.match(edit, /projectId={project\.id}/);
assert.match(nav, /label: "案件", href: "\/admin\/projects"/);
assert.match(nav, /label: "シフト運用", href: "\/admin\/shifts"/);
assert.doesNotMatch(nav, /label: "配置・休憩回し"|label: "前日確認"|label: "当日運用"/);
assert.doesNotMatch(nav, /label: "勤務先", href: "\/admin\/workplaces"/);
assert.doesNotMatch(detail + history, /\/worker\//);

console.log("Admin canonical Project IA: PASS (36 assertions)");
