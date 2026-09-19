import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dayOfHref, parseDayOfQuery } from "../../lib/admin/day-of/day-of-rules.ts";
import { parsePreShiftQuery, preShiftHref } from "../../lib/admin/pre-shift/pre-shift-rules.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [main, nav, header, create, choices, pre, preCanonical, preMonitor, day, dayCanonical, dayMonitor, sidebar, nestedCreate, bulkNestedCreate, shiftsAction] = await Promise.all([
  read("app/admin/shifts/page.tsx"),
  read("components/admin/shifts/shift-operations-nav.tsx"),
  read("components/admin/shifts/shift-page-header.tsx"),
  read("app/admin/shifts/new/page.tsx"),
  read("lib/admin/projects/get-shift-create-choices.ts"),
  read("app/admin/pre-shift/page.tsx"),
  read("app/admin/shifts/pre-shift/page.tsx"),
  read("components/admin/pre-shift/pre-shift-monitor.tsx"),
  read("app/admin/day-of/page.tsx"),
  read("app/admin/shifts/day-of/page.tsx"),
  read("components/admin/day-of/day-of-monitor.tsx"),
  read("components/admin/admin-nav.ts"),
  read("app/admin/projects/[projectId]/jobs/[jobId]/shifts/new/page.tsx"),
  read("app/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new/page.tsx"),
  read("app/actions/shifts.ts"),
]);

assert.match(main, /ShiftOperationsNav/);
assert.match(header, /href="\/admin\/shifts\/new"/);
assert.match(header, /title="シフト運用"/);
assert.match(nav, /シフト/);
assert.match(nav, /前日確認/);
assert.match(nav, /当日確認/);
assert.doesNotMatch(nav, /配置・休憩/);
assert.match(nav, /usePathname/);
assert.match(nav, /aria-current/);
assert.match(main, /ShiftViewControls/);
assert.match(main, /ShiftScheduleViews/);
assert.match(main, /ShiftList/);
assert.match(create, /name="projectId"/);
assert.match(create, /name="jobId"/);
assert.match(create, /!selectedProject/);
assert.match(create, /!selectedJob/);
assert.match(create, /job\.projectId === selectedProject\.id/);
assert.doesNotMatch(create, /jobs\[0\]|projects\[0\]/);
assert.match(choices, /\.eq\("project_id", projectId\)/);
assert.match(create, /getShiftFormOptions\(selectedProject\.id, selectedJob\.id\)/);
assert.match(preCanonical, /basePath="\/admin\/shifts\/pre-shift"/);
assert.match(pre, /redirect\(preShiftHref\(query,\{\},"\/admin\/shifts\/pre-shift"\)\)/);
assert.match(preMonitor, /basePath/);
assert.match(dayCanonical, /basePath="\/admin\/shifts\/day-of"/);
assert.match(day, /title="当日確認"/);
assert.match(day, /redirect\(dayOfHref\(query, \{\}, "\/admin\/shifts\/day-of"\)\)/);
assert.match(dayMonitor, /incidentAttention/);
assert.match(dayMonitor, /assignmentId/);
assert.match(sidebar, /label: "シフト運用", href: "\/admin\/shifts"/);
assert.match(nestedCreate, /\/admin\/shifts\/new\?\$\{new URLSearchParams/);
assert.match(nestedCreate, /projectId: projectId\.data, jobId: jobId\.data/);
assert.match(bulkNestedCreate, /\/admin\/shifts\/new\?\$\{new URLSearchParams/);
assert.match(bulkNestedCreate, /projectId: project\.data, jobId: job\.data/);
assert.match(shiftsAction, /\.eq\("id", jobId\)\.eq\("project_id", projectId\)/);
assert.equal(preShiftHref(parsePreShiftQuery({ date: "2026-09-15" }), {}, "/admin/shifts/pre-shift"), "/admin/shifts/pre-shift?date=2026-09-15");
assert.equal(dayOfHref(parseDayOfQuery({ date: "2026-09-15" }), {}, "/admin/shifts/day-of"), "/admin/shifts/day-of?date=2026-09-15");

console.log("Admin canonical Shift Operations: PASS (32 assertions)");
