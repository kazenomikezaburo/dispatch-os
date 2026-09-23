import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { candidateAssignmentDecision } from "../../lib/admin/staff/candidate-picker-types.ts";

let passed = 0;
function pass(name: string, condition: boolean) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

pass("no Application presents direct Admin decision", candidateAssignmentDecision("none") === "direct_admin_available");
pass("accepted Application presents accepted path", candidateAssignmentDecision("none", "accepted") === "accepted_application_available");
pass("applied Application requires lifecycle decision", candidateAssignmentDecision("none", "applied") === "application_decision_required");
pass("rejected Application cannot be overridden", candidateAssignmentDecision("none", "rejected") === "application_rejected");
pass("withdrawn Application cannot be overridden", candidateAssignmentDecision("none", "withdrawn") === "application_withdrawn");
pass("existing target Assignment takes precedence", candidateAssignmentDecision("active_existing", "rejected") === "existing_assignment");

const action = readFileSync("app/actions/candidate-assignments.ts", "utf8");
const picker = readFileSync("components/admin/placement/candidate-picker-drawer.tsx", "utf8");
const page = readFileSync("app/admin/shifts/[shiftId]/page.tsx", "utf8");
pass("server action calls only canonical Assignment command", action.includes('.rpc("ensure_candidate_assignment"') && !action.includes(".from(\"assignments\").insert"));
pass("server action refreshes canonical Placement plan", action.includes("getPlacementPlan(parsed.data.shiftId)"));
pass("server action verifies canonical Assignment before handoff", action.includes("plan?.assignments.some((item) => item.assignmentId === result.assignmentId)"));
pass("handoff uses returned canonical Assignment ID", picker.includes("response.assignmentId") && picker.includes("&assignmentId="));
pass("uncertain retry retains its operation key", picker.includes("if (!response.retryable)") && picker.includes("operation.current = null"));
pass("Placement editor receives only plan-confirmed Assignment", page.includes("placementPlan.assignments.some((item) => item.assignmentId === requestedAssignmentId)"));
pass("Picker never calls Placement save", !picker.includes("savePlacementPlan"));

console.log(`Candidate Assignment Handoff: ${passed}/${passed} passed`);
