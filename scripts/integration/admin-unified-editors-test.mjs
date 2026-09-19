import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PROJECT_EDITOR_SECTIONS,
  SHIFT_EDITOR_SECTIONS,
  isEditorMode,
  projectEditHref,
  shiftEditHref,
} from "../../components/admin/editor/admin-editor-contract.ts";
import { buildProjectEditInitialValues, buildShiftEditModel } from "../../components/admin/editor/admin-editor-values.ts";

assert.deepEqual(PROJECT_EDITOR_SECTIONS, ["基本情報", "期間", "説明・補足"]);
assert.deepEqual(SHIFT_EDITOR_SECTIONS, ["基本情報", "日程", "勤務条件"]);
assert.equal(projectEditHref("project/id"), "/admin/projects/project%2Fid?edit=1");
assert.equal(shiftEditHref("shift id"), "/admin/shifts/shift%20id?edit=1");
assert.equal(isEditorMode("1"), true);
assert.equal(isEditorMode(["1", "0"]), true);
assert.equal(isEditorMode("0"), false);
assert.equal(isEditorMode(undefined), false);

const projectValues = buildProjectEditInitialValues({
  name: "案件", branchId: "branch", clientId: "client", startDate: "2026-09-11", endDate: "2026-09-12", status: "recruiting", description: null,
});
assert.deepEqual(projectValues, { name: "案件", branch_id: "branch", client_id: "client", start_date: "2026-09-11", end_date: "2026-09-12", status: "recruiting", description: "" });

const shift = buildShiftEditModel({
  startsAt: "2026-09-11T23:30:00.000Z",
  endsAt: "2026-09-12T08:30:00.000Z",
  applicationDeadline: null,
  requiredWorkers: 3,
  breakMinutes: null,
  status: "recruiting",
  project: { id: "project", name: "案件" },
  job: { id: "job", name: "業務", hourlyWage: 1200, transportationFeeCap: null },
  workplace: { id: "workplace", name: "勤務先" },
});
assert.equal(shift.values.start_date, "2026-09-12");
assert.equal(shift.values.start_time, "08:30");
assert.equal(shift.values.end_date, "2026-09-12");
assert.equal(shift.values.required_workers, "3");
assert.equal(shift.values.break_minutes, "");
assert.equal(shift.options.project.id, "project");
assert.equal(shift.options.job.workplaceName, "勤務先");

const projectForm = await readFile(new URL("../../components/admin/projects/form/project-create-form.tsx", import.meta.url), "utf8");
const shiftCreate = await readFile(new URL("../../components/admin/projects/shifts/form/shift-create-editor.tsx", import.meta.url), "utf8");
const shiftEdit = await readFile(new URL("../../components/admin/projects/shifts/form/shift-create-form.tsx", import.meta.url), "utf8");
const projectPage = await readFile(new URL("../../app/admin/projects/[projectId]/page.tsx", import.meta.url), "utf8");
const shiftPage = await readFile(new URL("../../app/admin/shifts/[shiftId]/page.tsx", import.meta.url), "utf8");
const updateShiftCore = await readFile(new URL("../../lib/admin/projects/update-shift-core.ts", import.meta.url), "utf8");

assert.match(projectForm, /mode === "create"/);
assert.match(projectForm, /mode="edit"|mode === "edit"/);
assert.match(projectForm, /AdminEditorFooter/);
assert.match(projectForm, /expectedUpdatedAt/);
assert.match(shiftCreate, /initialShiftDates/);
assert.match(shiftCreate, /createBulkShifts/);
assert.match(shiftCreate, /プレビューを確認/);
assert.match(shiftCreate, /SHIFT_EDITOR_SECTIONS\[0\]/);
assert.match(shiftEdit, /SHIFT_EDITOR_SECTIONS\[0\]/);
assert.match(shiftEdit, /restrictions\?\.lockPlannedTime/);
assert.match(shiftEdit, /restrictions\?\.lockBreak/);
assert.match(shiftEdit, /expectedUpdatedAt/);
assert.match(projectPage, /isEditorMode\(query\.edit\)/);
assert.match(shiftPage, /isEditorMode\(query\.edit\)/);
assert.doesNotMatch(projectPage, /ProjectEditDrawer/);
assert.doesNotMatch(shiftPage, /ShiftEditDrawer/);
assert.match(updateShiftCore, /sameInstant\(values\.starts_at, row\.starts_at\)/);

console.log("Admin unified editors: PASS (33 assertions)");
