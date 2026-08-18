export const IDS = {
  users: {
    workerA: "a0000000-0000-0000-0000-000000000001",
    workerB: "a0000000-0000-0000-0000-000000000002",
    workerC: "a0000000-0000-0000-0000-000000000003",
    managerA: "a0000000-0000-0000-0000-000000000004",
    systemAdmin: "a0000000-0000-0000-0000-000000000005",
  },
  workers: {
    workerA: "c0000000-0000-0000-0000-000000000001",
    workerB: "c0000000-0000-0000-0000-000000000002",
    workerC: "c0000000-0000-0000-0000-000000000003",
  },
  branches: {
    nagoya: "b0000000-0000-0000-0000-000000000001",
    tokyo: "b0000000-0000-0000-0000-000000000002",
  },
  projects: {
    n1: "e0000000-0000-0000-0000-000000000001",
    n2: "e0000000-0000-0000-0000-000000000002",
    t1: "e0000000-0000-0000-0000-000000000003",
  },
  jobs: {
    n1: "10000000-0000-0000-0000-000000000001",
    t1: "10000000-0000-0000-0000-000000000003",
  },
  shifts: {
    n1: "20000000-0000-0000-0000-000000000001",
    n2: "20000000-0000-0000-0000-000000000002",
    t1: "20000000-0000-0000-0000-000000000003",
  },
  applications: {
    workerAN2: "30000000-0000-0000-0000-000000000001",
    workerBN1: "30000000-0000-0000-0000-000000000002",
  },
  assignments: {
    workerAN2: "40000000-0000-0000-0000-000000000001",
    workerBN1: "40000000-0000-0000-0000-000000000002",
    workerCT1: "40000000-0000-0000-0000-000000000003",
    workerAPast: "40000000-0000-0000-0000-000000000004",
    workerAFuture: "40000000-0000-0000-0000-000000000005",
  },
  confirmations: {
    workerB: "50000000-0000-0000-0000-000000000001",
    workerC: "50000000-0000-0000-0000-000000000002",
    workerAFuture: "50000000-0000-0000-0000-000000000003",
    workerAPast: "50000000-0000-0000-0000-000000000004",
  },
  events: {
    workerA: "60000000-0000-0000-0000-000000000001",
    workerB: "60000000-0000-0000-0000-000000000002",
    workerC: "60000000-0000-0000-0000-000000000003",
  },
  records: {
    workerA: "70000000-0000-0000-0000-000000000001",
    workerB: "70000000-0000-0000-0000-000000000002",
    workerC: "70000000-0000-0000-0000-000000000003",
  },
} as const;

export const TEST_PASSWORD = "TestPassword123!";

export const ACTORS = {
  workerA: { email: "worker-a@test.invalid", id: IDS.users.workerA },
  workerB: { email: "worker-b@test.invalid", id: IDS.users.workerB },
  workerC: { email: "worker-c@test.invalid", id: IDS.users.workerC },
  managerA: { email: "manager-a@test.invalid", id: IDS.users.managerA },
  systemAdmin: { email: "system-admin@test.invalid", id: IDS.users.systemAdmin },
} as const;

export const TABLES = [
  "branches", "profiles", "manager_branch_access", "workers", "clients",
  "projects", "workplaces", "jobs", "shift_slots", "shift_applications",
  "assignments", "pre_shift_confirmations", "attendance_events",
  "attendance_records",
] as const;

let counter = 1;
export function testUuid(group: number): string {
  const suffix = String(counter++).padStart(12, "0");
  return `9${String(group).padStart(7, "0")}-0000-0000-0000-${suffix}`;
}

