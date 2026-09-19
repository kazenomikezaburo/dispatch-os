import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseProjectDetailTab,
  projectDetailHref,
} from "../../components/admin/admin-detail-workflow-routes.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [listPage, detailPage, header, overview, jobs, shifts, history] = await Promise.all([
  read("app/admin/projects/page.tsx"),
  read("app/admin/projects/[projectId]/page.tsx"),
  read("components/admin/projects/detail/project-detail-header.tsx"),
  read("components/admin/projects/detail/project-overview.tsx"),
  read("components/admin/projects/detail/project-job-list.tsx"),
  read("components/admin/projects/detail/project-shift-section.tsx"),
  read("components/admin/projects/detail/project-history.tsx"),
]);

assert.doesNotMatch(listPage, /AdminWorkflowTabs/);
assert.match(listPage, /<ProjectSummary/);
assert.match(listPage, /<ProjectFilters/);
assert.match(listPage, /<ProjectList/);

assert.equal(parseProjectDetailTab(undefined), "overview");
assert.equal(parseProjectDetailTab("jobs"), "overview");
assert.equal(parseProjectDetailTab("shifts"), "shifts");
assert.equal(parseProjectDetailTab("history"), "history");
assert.equal(parseProjectDetailTab("unknown"), "overview");
assert.equal(projectDetailHref("project/id"), "/admin/projects/project%2Fid");
assert.equal(projectDetailHref("project/id", "shifts"), "/admin/projects/project%2Fid?tab=shifts");
assert.equal(projectDetailHref("project/id", "history"), "/admin/projects/project%2Fid?tab=history");

assert.match(detailPage, /label="案件情報"/);
assert.doesNotMatch(detailPage, /案件詳細ワークフロー/);
assert.match(detailPage, /tab === "overview"/);
assert.match(detailPage, /tab === "shifts"/);
assert.match(detailPage, /tab === "history"/);
assert.match(detailPage, /requestedTab === "jobs"/);
assert.match(detailPage, /redirect\(projectDetailHref\(project\.id\)\)/);
assert.doesNotMatch(detailPage, /ProjectOperationShortcuts|projectWorkflowHrefs/);
assert.match(header, /projectEditHref\(project\.id\)/);
assert.doesNotMatch(header, /シフトを作成/);
assert.match(overview, /project\.jobs\.length/);
assert.match(overview, /project\.summary\.shiftCount/);
assert.match(jobs, /ProjectJobItem/);
assert.match(shifts, /\/admin\/shifts\/\$\{shift\.id\}/);
assert.match(history, /変更履歴/);
assert.doesNotMatch(history, /JSON\.stringify\(event\.payload\)/);

console.log("Admin project management hub consistency: PASS (28 assertions)");
