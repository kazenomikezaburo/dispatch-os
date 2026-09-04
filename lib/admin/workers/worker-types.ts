export type WorkerStatus = "active" | "inactive" | "suspended";

export type WorkerListItem = {
  id: string;
  staffCode: string;
  displayName: string;
  status: WorkerStatus;
  branchId: string;
  branchName: string;
  recentWork: null | { startsAt: string; workplaceName: string };
};

export type WorkerHistoryItem = {
  assignmentId: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  assignmentStatus: string;
  projectId: string;
  projectName: string;
  jobName: string;
  workplaceName: string;
  attendance: null | { status: string; actualStartAt: string; actualEndAt: string };
};

export type WorkerDetail = {
  id: string;
  staffCode: string;
  displayName: string;
  status: WorkerStatus;
  branchId: string;
  branchName: string;
  authLinked: boolean;
  profileActive: boolean | null;
  createdAt: string;
  updatedAt: string;
  nextWork: WorkerHistoryItem | null;
  recentWork: WorkerHistoryItem | null;
  totalCompleted: number;
  absentCount: number;
  noShowCount: number;
  history: WorkerHistoryItem[];
  historyTotal: number;
};

export type WorkerBranchOption = { id: string; name: string };
