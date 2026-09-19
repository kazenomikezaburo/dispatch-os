import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseShiftDetailTab, shiftDetailHref } from "../../components/admin/admin-detail-workflow-routes.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [page, routes, header, surface, editor, loader, action, standalone, confirmation] = await Promise.all([
  read("app/admin/shifts/[shiftId]/page.tsx"),
  read("components/admin/admin-detail-workflow-routes.ts"),
  read("components/admin/shifts/shift-detail-header.tsx"),
  read("components/admin/placement/shift-placement-surface.tsx"),
  read("components/admin/placement/placement-editor.tsx"),
  read("lib/admin/placement/get-placement-plan.ts"),
  read("app/actions/placement.ts"),
  read("app/admin/placement/page.tsx"),
  read("components/admin/shifts/pre-shift-confirmation-section.tsx"),
]);

assert.equal(parseShiftDetailTab(undefined), "overview");
assert.equal(parseShiftDetailTab("applications"), "applications");
assert.equal(parseShiftDetailTab("placement"), "placement");
assert.equal(parseShiftDetailTab("confirmation"), "confirmation");
assert.equal(parseShiftDetailTab("assignments"), "overview");
assert.equal(shiftDetailHref("shift id", "placement"), "/admin/shifts/shift%20id?tab=placement");
assert.match(page, /label: "概要"/);
assert.match(page, /label: "応募"/);
assert.match(page, /label: "配置"/);
assert.match(page, /label: "確認"/);
assert.doesNotMatch(page, /label: "履歴"/);
assert.doesNotMatch(page, /ShiftOperationContext|shiftWorkflowHrefs/);
assert.match(page, /requestedTab === "assignments"/);
assert.match(page, /requestedTab === "confirmations"/);
assert.match(page, /redirect\(`\/admin\/shifts\/\$\{encodeURIComponent\(detail\.id\)\}/);
assert.match(page, /detail\.assignments\.some/);
assert.match(page, /getPlacementPlan\(detail\.id\)/);
assert.doesNotMatch(page, /getPlacement\(/);
assert.match(loader, /\.eq\("id", shiftId\)\.maybeSingle\(\)/);
assert.match(page, /ShiftPlacementSurface/);
assert.match(page, /placementMode === "create"/);
assert.match(surface, /assignmentId=\$\{encodeURIComponent\(assignment\.assignmentId\)\}/);
assert.doesNotMatch(page, /assignments\[0\]/);
assert.match(header, /\/admin\/projects\/\$\{detail\.project\.id\}/);
assert.match(header, /shiftEditHref\(detail\.id\)/);
assert.match(header, /detail\.workplace\.address/);
assert.match(surface, /positionCoverage/);
assert.match(surface, /plan\.breaks/);
assert.match(editor, /version: draft\.version/);
assert.match(editor, /saved\.type === "conflict"/);
assert.match(action, /save_shift_placement_plan/);
assert.match(action, /revalidatePath\(`\/admin\/shifts\/\$\{d\.shiftId\}`\)/);
assert.match(standalone, /export default async function PlacementPage/);
assert.match(standalone, /getPlacement\(query\.date\)/);
assert.match(confirmation, /title="前日確認"/);
assert.match(page, /ConfirmationPhaseNav/);
assert.doesNotMatch(routes, /"assignments" \| "confirmations"/);
assert.doesNotMatch(page + surface + editor, /@\/components\/worker|href=\{?[`"]\/worker\//);

console.log("Admin canonical Shift Detail & Placement: PASS (37 assertions)");
