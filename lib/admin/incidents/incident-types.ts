import type { OperationalIncidentCategory, OperationalIncidentState } from "@/lib/worker/incidents/worker-incident-ui";

export type AdminIncidentEvent = {
  id: string;
  eventType: "created" | "acknowledged" | "resolved" | "retracted";
  actorName: string;
  actorType: "worker" | "manager" | "system_admin";
  versionFrom: number;
  versionTo: number;
  createdAt: string;
};

export type AdminIncident = {
  id: string;
  assignmentId: string;
  category: OperationalIncidentCategory;
  message: string | null;
  state: OperationalIncidentState;
  version: number;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  retractedAt: string | null;
  workerId: string;
  workerName: string;
  staffCode: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  projectId: string;
  projectName: string;
  jobName: string;
  workplaceName: string;
};

export type AdminIncidentStateFilter = "unresolved" | OperationalIncidentState | "all";
export type AdminIncidentQuery = { state: AdminIncidentStateFilter; category: OperationalIncidentCategory | ""; q: string; page: number; incident: string };
