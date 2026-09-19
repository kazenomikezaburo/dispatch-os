import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const [styles, workflow, section, detail, shiftOperation, projectPage, shiftPage] = await Promise.all([
  read("components/admin/admin-navigation-tab-styles.ts"),
  read("components/admin/admin-workflow-tabs.tsx"),
  read("components/admin/admin-section-tabs.tsx"),
  read("components/admin/admin-detail-workflow-nav.tsx"),
  read("components/admin/shifts/shift-operation-context.tsx"),
  read("app/admin/projects/[projectId]/page.tsx"),
  read("app/admin/shifts/[shiftId]/page.tsx"),
]);

assert.match(styles, /min-h-11/, "All tab levels must retain a 44px interaction target.");
assert.match(styles, /after:inset-x-3 after:bottom-0 after:h-0\.5 after:bg-primary/, "All levels must share one underline geometry.");
assert.match(styles, /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring/, "All levels must share the focus vocabulary.");
assert.match(styles, /hover:bg-surface-hover hover:text-foreground/, "All levels must share the hover vocabulary.");
assert.match(styles, /adminWorkflowTabClass = "rounded-t-lg px-4"/, "Level 1 must retain the strongest workflow shape.");
assert.match(styles, /adminWorkspaceTabClass = "px-4"/, "Level 2 must use the workspace spacing rhythm.");
assert.match(styles, /adminDetailTabClass = "px-3"/, "Level 3 must be visually quieter while retaining the hit target.");

for (const [name, source] of [["collection workflow", workflow], ["workspace", section], ["entity detail", detail], ["Shift operation", shiftOperation]]) {
  assert.match(source, /adminNavigationTabBaseClass/, `${name} must consume the shared base vocabulary.`);
  assert.match(source, /adminNavigationTabActiveClass/, `${name} must consume the shared active vocabulary.`);
  assert.match(source, /aria-current=/, `${name} must retain aria-current semantics.`);
  assert.match(source, /<Link/, `${name} must retain real Link navigation.`);
  assert.match(source, /overflow-x-auto/, `${name} must contain narrow-screen overflow.`);
}

assert.doesNotMatch(detail, /bg-surface-muted|rounded-control bg-surface-muted/, "Level 3 navigation must not regress to a segmented-control treatment.");
assert.match(projectPage, /AdminDetailWorkflowNav label="案件情報"/, "Project internal navigation must remain Level 3.");
assert.match(shiftPage, /AdminDetailWorkflowNav label="シフト詳細"/, "Shift internal navigation must remain Level 3.");
assert.doesNotMatch(workflow + section + detail + shiftOperation, /\/worker\//, "Admin navigation must not generate Worker routes.");

console.log("Admin navigation family: PASS (31 assertions)");
