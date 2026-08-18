import type {
  DashboardAlert,
  DashboardAssignmentInput,
  DashboardData,
  DashboardRuleInput,
  DashboardWorkplace,
} from "./dashboard-types";

export const ACTIVE_ASSIGNMENT_STATUSES = [
  "assigned",
  "confirmed",
  "completed",
] as const;

const activeAssignmentStatusSet = new Set<string>(ACTIVE_ASSIGNMENT_STATUSES);

export function isActiveAssignment(assignment: DashboardAssignmentInput) {
  return activeAssignmentStatusSet.has(assignment.status);
}

const severityRank = { critical: 0, warning: 1 } as const;

export function buildDashboardData(input: DashboardRuleInput): DashboardData {
  const shiftById = new Map(input.shifts.map((shift) => [shift.id, shift]));
  const activeAssignments = input.assignments.filter(
    (assignment) =>
      isActiveAssignment(assignment) && shiftById.has(assignment.shiftSlotId),
  );
  const assignmentsByShift = new Map<string, DashboardAssignmentInput[]>();

  for (const assignment of activeAssignments) {
    const current = assignmentsByShift.get(assignment.shiftSlotId) ?? [];
    current.push(assignment);
    assignmentsByShift.set(assignment.shiftSlotId, current);
  }

  const alerts: DashboardAlert[] = [];

  for (const assignment of activeAssignments) {
    const shift = shiftById.get(assignment.shiftSlotId);
    if (!shift) continue;

    const shiftStarted = input.now.getTime() > new Date(shift.startsAt).getTime();
    const startWorkMissing = !input.startWorkAssignmentIds.has(assignment.id);

    if (shiftStarted && startWorkMissing) {
      alerts.push({
        id: `attendance-missing:${assignment.id}`,
        type: "attendance_missing",
        severity: "critical",
        title: "勤務開始報告がありません",
        description: `${shift.projectName} / ${shift.workplaceName}`,
        href: "/admin/attendance",
        workerId: assignment.workerId,
        workerName: assignment.workerName,
        assignmentId: assignment.id,
        shiftSlotId: shift.id,
        startsAt: shift.startsAt,
        projectName: shift.projectName,
        workplaceName: shift.workplaceName,
      });
    } else if (!input.confirmedAssignmentIds.has(assignment.id)) {
      alerts.push({
        id: `pre-shift-missing:${assignment.id}`,
        type: "pre_shift_missing",
        severity: "warning",
        title: "前日確認が提出されていません",
        description: `${shift.projectName} / ${shift.workplaceName}`,
        href: "/admin/shifts",
        workerId: assignment.workerId,
        workerName: assignment.workerName,
        assignmentId: assignment.id,
        shiftSlotId: shift.id,
        startsAt: shift.startsAt,
        projectName: shift.projectName,
        workplaceName: shift.workplaceName,
      });
    }
  }

  for (const shift of input.shifts) {
    const assignedWorkers = assignmentsByShift.get(shift.id)?.length ?? 0;
    const shortage = Math.max(shift.requiredWorkers - assignedWorkers, 0);
    if (shortage === 0) continue;

    alerts.push({
      id: `staffing-shortage:${shift.id}`,
      type: "staffing_shortage",
      severity: "critical",
      title: "人員が不足しています",
      description: `必要${shift.requiredWorkers}名 / 配置${assignedWorkers}名 / 不足${shortage}名`,
      href: "/admin/shifts",
      shiftSlotId: shift.id,
      startsAt: shift.startsAt,
      projectName: shift.projectName,
      workplaceName: shift.workplaceName,
      requiredWorkers: shift.requiredWorkers,
      assignedWorkers,
      shortage,
    });
  }

  alerts.sort((left, right) => {
    const severityDifference = severityRank[left.severity] - severityRank[right.severity];
    if (severityDifference !== 0) return severityDifference;
    const timeDifference = left.startsAt.localeCompare(right.startsAt);
    return timeDifference !== 0 ? timeDifference : left.id.localeCompare(right.id);
  });

  const activeWorkerIds = new Set(activeAssignments.map((assignment) => assignment.workerId));
  const alertedWorkerIds = new Set(
    alerts.flatMap((alert) =>
      alert.type === "staffing_shortage" ? [] : [alert.workerId],
    ),
  );
  const workplaces = buildWorkplaces(
    input.shifts,
    assignmentsByShift,
    alerts,
  );

  return {
    summary: {
      activeWorkers: activeWorkerIds.size,
      normalWorkers: [...activeWorkerIds].filter(
        (workerId) => !alertedWorkerIds.has(workerId),
      ).length,
      alertCount: alerts.length,
    },
    alerts,
    workplaces,
  };
}

function buildWorkplaces(
  shifts: DashboardRuleInput["shifts"],
  assignmentsByShift: Map<string, DashboardAssignmentInput[]>,
  alerts: DashboardAlert[],
) {
  const groups = new Map<string, DashboardWorkplace>();
  const workerAlertShiftIds = new Set(
    alerts.flatMap((alert) =>
      alert.type === "staffing_shortage" ? [] : [alert.shiftSlotId],
    ),
  );

  for (const shift of shifts) {
    const assignedWorkers = assignmentsByShift.get(shift.id)?.length ?? 0;
    const existing = groups.get(shift.jobId);

    if (existing) {
      existing.requiredWorkers += shift.requiredWorkers;
      existing.assignedWorkers += assignedWorkers;
      if (shift.startsAt < existing.startsAt) existing.startsAt = shift.startsAt;
      if (shift.endsAt > existing.endsAt) existing.endsAt = shift.endsAt;
      existing.hasWorkerAlert ||= workerAlertShiftIds.has(shift.id);
    } else {
      groups.set(shift.jobId, {
        id: shift.jobId,
        jobId: shift.jobId,
        projectName: shift.projectName,
        workplaceName: shift.workplaceName,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        requiredWorkers: shift.requiredWorkers,
        assignedWorkers,
        shortage: 0,
        progress: 0,
        status: "normal",
        hasWorkerAlert: workerAlertShiftIds.has(shift.id),
        href: "/admin/shifts",
      });
    }
  }

  const workplaces = [...groups.values()].map((workplace) => {
    workplace.shortage = Math.max(
      workplace.requiredWorkers - workplace.assignedWorkers,
      0,
    );
    workplace.progress =
      workplace.requiredWorkers === 0
        ? 0
        : Math.round(
            (workplace.assignedWorkers / workplace.requiredWorkers) * 100,
          );
    workplace.status =
      workplace.shortage > 0 || workplace.hasWorkerAlert
        ? "attention"
        : "normal";
    return workplace;
  });

  workplaces.sort((left, right) => {
    const shortageDifference = Number(right.shortage > 0) - Number(left.shortage > 0);
    if (shortageDifference !== 0) return shortageDifference;
    const alertDifference = Number(right.hasWorkerAlert) - Number(left.hasWorkerAlert);
    if (alertDifference !== 0) return alertDifference;
    const timeDifference = left.startsAt.localeCompare(right.startsAt);
    if (timeDifference !== 0) return timeDifference;
    return `${left.projectName}:${left.workplaceName}`.localeCompare(
      `${right.projectName}:${right.workplaceName}`,
      "ja",
    );
  });

  return workplaces;
}
