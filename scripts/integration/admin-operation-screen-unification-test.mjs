import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { shiftOperationItems } from "../../components/admin/admin-detail-workflow-routes.ts";

const input = { projectId: "project/id", shiftId: "shift id", date: "2099-01-15" };
for (const active of ["shift", "placement", "pre-shift", "day-of"]) {
  const items = shiftOperationItems({ ...input, active });
  assert.equal(items.length, 4);
  assert.equal(items.filter((item) => item.current).length, 1);
  assert.equal(items.find((item) => item.current)?.key, active);
  assert.equal(items[0].href, "/admin/shifts/shift%20id");
  assert.equal(items[1].href, "/admin/shifts/shift%20id?tab=placement");
  assert.equal(items[2].href, "/admin/shifts/shift%20id?tab=confirmation&phase=pre");
  assert.equal(items[3].href, "/admin/shifts/shift%20id?tab=confirmation&phase=day");
}

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const component = await read("components/admin/shifts/shift-operation-context.tsx");
const tabStyles = await read("components/admin/admin-navigation-tab-styles.ts");
const shift = await read("app/admin/shifts/[shiftId]/page.tsx");
const placement = await read("app/admin/placement/page.tsx");
const preShift = await read("app/admin/pre-shift/page.tsx");
const dayOf = await read("app/admin/day-of/page.tsx");

assert.match(component, /aria-label="シフト運用工程"/);
assert.match(component, /aria-current=/);
assert.match(tabStyles, /min-h-11/);
assert.match(component, /overflow-x-auto/);
assert.doesNotMatch(shift, /ShiftOperationContext|phase="shift"/, "Single-Shift detail must not repeat the cross-shift operation row.");
assert.match(shift, /AdminDetailWorkflowNav label="シフト詳細"/, "Single-Shift detail keeps one canonical detail navigation row.");
assert.match(placement, /phase="placement"/);
assert.match(preShift, /phase="pre-shift"/);
assert.match(dayOf, /phase="day-of"/);
assert.match(placement, /find\(\(shift\) => shift\.id === query\.shift\)/);
assert.match(preShift, /find\(i=>i\.shiftId===query\.shift\)/);
assert.match(dayOf, /find\(\(item\) => item\.shiftId === query\.shift\)/);
assert.doesNotMatch(preShift, /items\[0\]/);
assert.doesNotMatch(dayOf, /all\[0\]/);
assert.doesNotMatch(component, /worker|assignment/i);

console.log("Admin operation screen unification: PASS (43 assertions)");
