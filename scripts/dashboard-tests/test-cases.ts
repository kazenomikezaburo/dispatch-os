// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { buildDashboardData } from "../../lib/admin/dashboard/dashboard-rules.ts";

export type DashboardTestResult = {
  id: `DASH-${string}`;
  description: string;
  expected: string;
  actual: string;
  passed: boolean;
  category: "Data Rules" | "Alert Rules" | "Aggregation" | "RLS" | "Empty State" | "Error Handling";
};

export function ruleTestCases(): DashboardTestResult[] {
  const past = "2026-01-15T00:00:00.000Z";
  const future = "2026-01-15T12:00:00.000Z";
  const end = "2026-01-15T13:00:00.000Z";
  const shifts = [
    { id: "s1", jobId: "j1", startsAt: past, endsAt: end, requiredWorkers: 3, projectName: "TEST_PROJECT_A", workplaceName: "TEST_WORKPLACE_A" },
    { id: "s2", jobId: "j1", startsAt: future, endsAt: end, requiredWorkers: 1, projectName: "TEST_PROJECT_A", workplaceName: "TEST_WORKPLACE_A" },
    { id: "s3", jobId: "j2", startsAt: future, endsAt: end, requiredWorkers: 3, projectName: "TEST_PROJECT_B", workplaceName: "TEST_WORKPLACE_B" },
  ];
  const assignments = [
    { id: "a1", shiftSlotId: "s1", workerId: "w1", workerName: "TEST_WORKER_1", status: "confirmed" },
    { id: "a2", shiftSlotId: "s1", workerId: "w2", workerName: "TEST_WORKER_2", status: "assigned" },
    { id: "a3", shiftSlotId: "s2", workerId: "w1", workerName: "TEST_WORKER_1", status: "assigned" },
    { id: "a4", shiftSlotId: "s3", workerId: "w3", workerName: "TEST_WORKER_3", status: "confirmed" },
    { id: "a5", shiftSlotId: "s3", workerId: "w4", workerName: "TEST_WORKER_4", status: "completed" },
    { id: "a6", shiftSlotId: "s3", workerId: "w5", workerName: "TEST_WORKER_5", status: "confirmed" },
    { id: "a7", shiftSlotId: "s1", workerId: "w6", workerName: "TEST_EXCLUDED", status: "no_show" },
  ];
  const data = buildDashboardData({
    now: new Date("2026-01-15T06:00:00.000Z"),
    shifts,
    assignments,
    startWorkAssignmentIds: new Set(["a4", "a5", "a6"]),
    confirmedAssignmentIds: new Set(["a4", "a5", "a6"]),
  });
  const jobOne = data.workplaces.find((workplace) => workplace.jobId === "j1");
  const empty = buildDashboardData({
    now: new Date("2026-01-15T06:00:00.000Z"),
    shifts: [],
    assignments: [],
    startWorkAssignmentIds: new Set(),
    confirmedAssignmentIds: new Set(),
  });

  return [
    result("DASH-001", "Today active workers", "5 unique workers", `${data.summary.activeWorkers} unique workers`, data.summary.activeWorkers === 5, "Data Rules"),
    result("DASH-002", "Duplicate worker assignments", "w1 counted once", `activeWorkers=${data.summary.activeWorkers}`, data.summary.activeWorkers === 5, "Data Rules"),
    result("DASH-003", "Missing start_work alert", "critical attendance_missing for a1", alertSummary(data, "a1"), data.alerts.some((alert) => alert.type === "attendance_missing" && alert.assignmentId === "a1" && alert.severity === "critical"), "Alert Rules"),
    result("DASH-004", "Missing pre-shift confirmation", "warning pre_shift_missing for a3", alertSummary(data, "a3"), data.alerts.some((alert) => alert.type === "pre_shift_missing" && alert.assignmentId === "a3" && alert.severity === "warning"), "Alert Rules"),
    result("DASH-005", "Worker alert deduplication", "only attendance_missing for a1", alertSummary(data, "a1"), data.alerts.filter((alert) => alert.type !== "staffing_shortage" && alert.assignmentId === "a1").length === 1 && data.alerts.some((alert) => alert.type === "attendance_missing" && alert.assignmentId === "a1"), "Alert Rules"),
    result("DASH-006", "Staffing shortage", "s1 shortage=1", shortageSummary(data, "s1"), data.alerts.some((alert) => alert.type === "staffing_shortage" && alert.shiftSlotId === "s1" && alert.shortage === 1), "Alert Rules"),
    result("DASH-007", "Fully staffed shift", "no shortage alert for s3", shortageSummary(data, "s3"), !data.alerts.some((alert) => alert.type === "staffing_shortage" && alert.shiftSlotId === "s3"), "Alert Rules"),
    result("DASH-008", "Job workplace aggregation", "required=4 assigned=3 shortage=1 progress=75", jobOne ? `required=${jobOne.requiredWorkers} assigned=${jobOne.assignedWorkers} shortage=${jobOne.shortage} progress=${jobOne.progress}` : "job missing", Boolean(jobOne && jobOne.requiredWorkers === 4 && jobOne.assignedWorkers === 3 && jobOne.shortage === 1 && jobOne.progress === 75), "Aggregation"),
    result("DASH-011", "Empty dashboard data", "zero summary and empty arrays", `active=${empty.summary.activeWorkers} normal=${empty.summary.normalWorkers} alerts=${empty.alerts.length} workplaces=${empty.workplaces.length}`, empty.summary.activeWorkers === 0 && empty.summary.normalWorkers === 0 && empty.summary.alertCount === 0 && empty.alerts.length === 0 && empty.workplaces.length === 0, "Empty State"),
  ];
}

export function result(
  id: DashboardTestResult["id"],
  description: string,
  expected: string,
  actual: string,
  passed: boolean,
  category: DashboardTestResult["category"],
): DashboardTestResult {
  return { id, description, expected, actual, passed, category };
}

function alertSummary(data: ReturnType<typeof buildDashboardData>, assignmentId: string) {
  return data.alerts
    .filter((alert) => alert.type !== "staffing_shortage" && alert.assignmentId === assignmentId)
    .map((alert) => `${alert.type}:${alert.severity}`)
    .join(", ") || "none";
}

function shortageSummary(data: ReturnType<typeof buildDashboardData>, shiftSlotId: string) {
  const alert = data.alerts.find((candidate) => candidate.type === "staffing_shortage" && candidate.shiftSlotId === shiftSlotId);
  return alert?.type === "staffing_shortage" ? `shortage=${alert.shortage}` : "no shortage";
}
