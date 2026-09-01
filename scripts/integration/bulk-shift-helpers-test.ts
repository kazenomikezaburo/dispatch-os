import assert from "node:assert/strict";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { generateDates, normalizeOverride, resolveShiftConfig, type BulkShiftConfig } from "../../lib/admin/projects/bulk-shift-helpers.ts";

const base: BulkShiftConfig = { startTime: "09:00", endTime: "18:00", endsNextDay: false, requiredWorkers: "10", breakMinutes: "60", deadlineEnabled: false, deadlineDaysBefore: "2", deadlineTime: "18:00", status: "recruiting" };
const dates = generateDates("2026-09-01", "2026-09-07", [1, 3, 5]);
assert.deepEqual(dates, ["2026-09-02", "2026-09-04", "2026-09-07"]);
assert.equal(new Set(dates).size, dates.length);

const override = normalizeOverride(base, { ...base, startTime: "10:00", requiredWorkers: "14" });
assert.deepEqual(override, { startTime: "10:00", requiredWorkers: "14" });
assert.deepEqual(resolveShiftConfig({ ...base, requiredWorkers: "12" }, override), { ...base, startTime: "10:00", requiredWorkers: "14" });
assert.deepEqual(normalizeOverride(base, base), {});
assert.deepEqual(generateDates("2026-09-07", "2026-09-01", [1]), []);

console.log("Bulk shift helper tests passed.");
