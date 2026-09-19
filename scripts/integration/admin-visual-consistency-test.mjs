import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const primitive = await read("components/admin/admin-visual-primitives.tsx");
assert.match(primitive, /export function AdminKpiCard/);
assert.match(primitive, /export function AdminStatusBadge/);
assert.match(primitive, /rounded-card border border-border bg-surface/);
assert.match(primitive, /rounded-pill/);
assert.doesNotMatch(primitive, /slate-|blue-|gray-/);

for (const path of [
  "components/admin/dashboard/dashboard-summary-card.tsx",
  "components/admin/projects/project-summary.tsx",
  "components/admin/shifts/shift-summary.tsx",
  "components/admin/attendance/attendance-summary.tsx",
]) {
  assert.match(await read(path), /AdminKpiCard/, `${path} must use the shared KPI card.`);
}

for (const path of [
  "components/admin/projects/project-status-badge.tsx",
  "components/admin/shifts/shift-status-badge.tsx",
  "components/admin/shifts/staffing-status-badge.tsx",
  "components/admin/shifts/application-status-badge.tsx",
  "components/admin/shifts/assignment-status-badge.tsx",
  "components/admin/shifts/pre-shift-confirmation-status-badge.tsx",
  "components/admin/attendance/attendance-status-badge.tsx",
  "components/admin/workers/worker-status-badge.tsx",
  "components/admin/announcements/announcement-status-badge.tsx",
]) {
  assert.match(await read(path), /AdminStatusBadge/, `${path} must use the shared status badge.`);
}

for (const path of [
  "components/admin/projects/project-page-header.tsx",
  "components/admin/shifts/shift-page-header.tsx",
  "app/admin/attendance/page.tsx",
  "app/admin/workers/page.tsx",
  "app/admin/incidents/page.tsx",
  "app/admin/announcements/page.tsx",
  "app/admin/clients/page.tsx",
  "app/admin/workplaces/page.tsx",
]) {
  assert.match(await read(path), /AdminPageHeader|MasterWorkspaceHeader|CommunicationWorkspaceHeader/, `${path} must retain a shared page header.`);
}

for (const path of [
  "components/admin/projects/project-empty-state.tsx",
  "components/admin/shifts/shift-empty-state.tsx",
  "app/admin/announcements/page.tsx",
  "app/admin/clients/page.tsx",
]) {
  assert.match(await read(path), /AdminEmptyState/, `${path} must retain the shared empty state.`);
}

const projectDetail = await read("app/admin/projects/[projectId]/page.tsx");
const shiftDetail = await read("app/admin/shifts/[shiftId]/page.tsx");
const announcementDetail = await read("app/admin/announcements/[announcementId]/page.tsx");
assert.match(projectDetail, /AdminDetailWorkflowNav/);
assert.match(projectDetail, /isEditorMode\(query\.edit\)/);
assert.match(shiftDetail, /AdminDetailWorkflowNav/);
assert.match(shiftDetail, /isEditorMode\(query\.edit\)/);
assert.match(announcementDetail, /detail\.announcement\.state\s*===\s*"draft"/);

console.log("Admin visual consistency: PASS (35 assertions)");
