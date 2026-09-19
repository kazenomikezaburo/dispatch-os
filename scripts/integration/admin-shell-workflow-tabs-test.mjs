import assert from "node:assert/strict";
import {
  adminWorkflowTabs,
  getActiveAdminWorkflowHref,
} from "../../components/admin/admin-workflow-tabs-config.ts";

const expected = [
  ["案件", "/admin/projects"],
  ["シフト", "/admin/shifts"],
  ["配置・休憩", "/admin/placement"],
  ["前日確認", "/admin/pre-shift"],
  ["当日運用", "/admin/day-of"],
];

assert.deepEqual(
  adminWorkflowTabs.map(({ label, href }) => [label, href]),
  expected,
  "Workflow tabs must retain the five canonical routes in workflow order.",
);

for (const [, href] of expected) {
  assert.equal(
    getActiveAdminWorkflowHref(href),
    href,
    `${href} must be the single active workflow tab.`,
  );
}

for (const pathname of [
  "/admin",
  "/admin/attendance",
  "/admin/projects/new",
  "/admin/projects/project-id",
  "/worker",
]) {
  assert.equal(
    getActiveAdminWorkflowHref(pathname),
    null,
    `${pathname} must not render list-level workflow tabs.`,
  );
}

console.log("Admin shell workflow tabs: PASS (11 assertions)");
