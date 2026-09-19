import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [nav, tabs, placement, workplaces, preShift, dayOf, nestedCreate, bulkNestedCreate, routes, monitor, drawer, incidentDrawer, shiftPage] = await Promise.all([
  read("components/admin/admin-nav.ts"),
  read("components/admin/admin-workflow-tabs-config.ts"),
  read("app/admin/placement/page.tsx"),
  read("app/admin/workplaces/page.tsx"),
  read("app/admin/pre-shift/page.tsx"),
  read("app/admin/day-of/page.tsx"),
  read("app/admin/projects/[projectId]/jobs/[jobId]/shifts/new/page.tsx"),
  read("app/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new/page.tsx"),
  read("components/admin/admin-detail-workflow-routes.ts"),
  read("components/admin/day-of/day-of-monitor.tsx"),
  read("components/admin/day-of/day-of-drawer.tsx"),
  read("components/admin/incidents/incident-drawer.tsx"),
  read("app/admin/shifts/[shiftId]/page.tsx"),
]);

for (const legacyHref of ["/admin/placement", "/admin/pre-shift", "/admin/day-of", "/admin/workplaces"]) {
  assert.doesNotMatch(nav, new RegExp(`href: "${legacyHref.replaceAll("/", "\\/")}"`));
}
assert.match(tabs, /href: "\/admin\/shifts\/pre-shift"/);
assert.match(tabs, /href: "\/admin\/shifts\/day-of"/);
assert.doesNotMatch(tabs, /href: "\/admin\/pre-shift"|href: "\/admin\/day-of"/);

assert.match(preShift, /redirect\(preShiftHref\(query,\{\},"\/admin\/shifts\/pre-shift"\)\)/);
assert.match(dayOf, /redirect\(dayOfHref\(query, \{\}, "\/admin\/shifts\/day-of"\)\)/);
assert.match(nestedCreate, /uuidSchema\.safeParse/);
assert.match(nestedCreate, /\/admin\/shifts\/new\?\$\{new URLSearchParams/);
assert.match(bulkNestedCreate, /uuidSchema\.safeParse/);
assert.match(bulkNestedCreate, /\/admin\/shifts\/new\?\$\{new URLSearchParams/);
assert.doesNotMatch(nestedCreate + bulkNestedCreate, /projects\[0\]|jobs\[0\]|shifts\[0\]/);

assert.match(placement, /export default async function PlacementPage/);
assert.match(placement, /parsePlacementQuery/);
assert.match(workplaces, /MasterList kind="workplace"/);
assert.match(routes, /placement: shiftDetailHref\(input\.shiftId, "placement"\)/);
assert.match(routes, /phase=pre/);
assert.match(routes, /phase=day/);
assert.doesNotMatch(routes, /projectWorkflowHrefs|contextHref|\/admin\/pre-shift|\/admin\/day-of|\/admin\/placement/);
assert.match(monitor, /shiftDetailHref\(shift\.shiftId, "placement"\)/);
assert.match(drawer, /shiftDetailHref\(item\.shiftId, "placement"\)/);
assert.match(incidentDrawer, /singleShiftConfirmationHref\(incident\.shiftId, "day", incident\.assignmentId\)/);
assert.match(shiftPage, /requestedTab === "assignments"/);
assert.match(shiftPage, /requestedTab === "confirmations"/);

console.log("Admin legacy compatibility cleanup: PASS (25 assertions)");
