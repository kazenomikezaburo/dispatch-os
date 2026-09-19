import assert from "node:assert/strict";
import {
  parseProjectDetailTab,
  parseShiftDetailTab,
  projectDetailHref,
  projectWorkflowHrefs,
  shiftDetailHref,
  shiftWorkflowHrefs,
} from "../../components/admin/admin-detail-workflow-routes.ts";
import {
  filterPreShiftItems,
  parsePreShiftQuery,
  preShiftHref,
} from "../../lib/admin/pre-shift/pre-shift-rules.ts";
import { parseDayOfQuery, dayOfHref } from "../../lib/admin/day-of/day-of-rules.ts";
import { parseAttendanceQuery } from "../../lib/admin/attendance/attendance-query-schema.ts";

const projectId = "project/id";
const shiftId = "shift id";
const date = "2026-09-11";

assert.equal(parseProjectDetailTab(undefined), "overview");
assert.equal(parseProjectDetailTab("jobs"), "overview");
assert.equal(parseProjectDetailTab("history"), "history");
assert.equal(parseProjectDetailTab("invalid"), "overview");
assert.equal(parseShiftDetailTab(undefined), "overview");
assert.equal(parseShiftDetailTab("placement"), "placement");
assert.equal(parseShiftDetailTab(["confirmation", "overview"]), "confirmation");
assert.equal(parseShiftDetailTab("invalid"), "overview");
assert.equal(projectDetailHref(projectId), "/admin/projects/project%2Fid");
assert.equal(projectDetailHref(projectId, "shifts"), "/admin/projects/project%2Fid?tab=shifts");
assert.equal(shiftDetailHref(shiftId, "applications"), "/admin/shifts/shift%20id?tab=applications");

const projectRoutes = projectWorkflowHrefs(projectId);
assert.equal(projectRoutes.shifts, "/admin/projects/project%2Fid?tab=shifts");
assert.equal(projectRoutes.placement, "/admin/placement?project=project%2Fid");
assert.equal(projectRoutes.preShift, "/admin/pre-shift?project=project%2Fid");
assert.equal(projectRoutes.dayOf, "/admin/day-of?project=project%2Fid");
assert.ok(Object.values(projectRoutes).every((href) => !href.includes("assignment=")));

const shiftRoutes = shiftWorkflowHrefs({ projectId, shiftId, date });
assert.equal(shiftRoutes.project, "/admin/projects/project%2Fid");
assert.equal(shiftRoutes.shift, "/admin/shifts/shift%20id");
assert.equal(shiftRoutes.placement, "/admin/placement?date=2026-09-11&shift=shift+id");
assert.equal(shiftRoutes.preShift, "/admin/pre-shift?date=2026-09-11&shift=shift+id");
assert.equal(shiftRoutes.dayOf, "/admin/day-of?date=2026-09-11&shift=shift+id");
assert.equal(shiftRoutes.attendance, "/admin/attendance?date=2026-09-11&shift=shift+id");
assert.ok(Object.values(shiftRoutes).every((href) => !href.includes("assignment=")));
assert.ok(Object.values(shiftRoutes).every((href) => !href.startsWith("/worker")));

const now = new Date("2026-09-10T00:00:00Z");
const preShiftQuery = parsePreShiftQuery({ date, shift: "s-1" }, now);
const items = ["a-1", "a-2"].map((assignmentId) => ({
  assignmentId,
  assignmentStatus: "assigned",
  workerId: `w-${assignmentId}`,
  workerName: assignmentId,
  shiftId: "s-1",
  startsAt: "2026-09-11T00:00:00Z",
  endsAt: "2026-09-11T08:00:00Z",
  projectId: "p-1",
  projectName: "案件",
  jobId: "j-1",
  jobName: "業務",
  workplaceId: "wp-1",
  workplaceName: "勤務先",
  confirmation: null,
}));
assert.deepEqual(filterPreShiftItems(items, preShiftQuery).map((item) => item.assignmentId), ["a-1", "a-2"]);
assert.equal(filterPreShiftItems(items, { ...preShiftQuery, shift: "missing" }).length, 0);
assert.equal(preShiftHref(preShiftQuery), "/admin/pre-shift?date=2026-09-11&shift=s-1");
assert.equal(parseDayOfQuery({ date, shift: "s-1" }, now).shift, "s-1");
assert.equal(dayOfHref(parseDayOfQuery({ date, shift: "s-1" }, now)), "/admin/day-of?date=2026-09-11&shift=s-1");
assert.equal(parseAttendanceQuery({ date, shift: "s-1" }).shift, "s-1");

console.log("Admin detail workflow tabs: PASS (29 assertions)");
