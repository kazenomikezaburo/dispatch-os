import assert from "node:assert/strict";
import { buildAttendanceData, deriveAdminAttendance } from "../../lib/admin/attendance/attendance-rules.ts";
import { parseAttendanceQuery } from "../../lib/admin/attendance/attendance-query-schema.ts";

const base = {
  shiftId: "shift",
  status: "assigned",
  workerName: "山田 太郎",
  startsAt: "2026-09-04T00:00:00Z",
  endsAt: "2026-09-04T09:00:00Z",
  projectName: "展示会",
  jobName: "受付",
  workplaceName: "会場",
  startWorkAt: null,
  endWorkAt: null,
};
const query = parseAttendanceQuery({ date: "2026-09-04", confirmation: "corrected", page: "2" });
assert.equal(query.confirmation, "corrected");
assert.equal(query.page, 2);
assert.deepEqual(parseAttendanceQuery({ date: "invalid", confirmation: "invalid", page: "-1" }).confirmation, "all");

const now = new Date("2026-09-03T23:00:00Z");
const corrected = deriveAdminAttendance({ ...base, id: "one" }, now, "corrected");
assert.equal(corrected.confirmationState, "corrected");
assert.equal(corrected.state, "scheduled");

const inputs = Array.from({ length: 25 }, (_, index) => ({ ...base, id: String(index).padStart(2, "0"), workerName: `スタッフ${index}` }));
const confirmations = new Map(inputs.map((item) => [item.id, "corrected"]));
const data = buildAttendanceData(inputs, { ...query, q: "", state: "all", attention: "all" }, now, confirmations);
assert.equal(data.totalAssignments, 25);
assert.equal(data.totalFiltered, 25);
assert.equal(data.items.length, 5);
assert.equal(data.summary.corrected, 25);
console.log("attendance UI rules: PASS");
