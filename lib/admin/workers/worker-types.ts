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

export type SkillMasterItem = { id:string; code:string; name:string; description:string|null; isActive:boolean; updatedAt:string };
export type QualificationExpiryPolicy = "none"|"optional"|"required";
export type QualificationMasterItem = SkillMasterItem & { expiryPolicy:QualificationExpiryPolicy };
export type WorkerSkillHolding = { skillId:string; code:string; name:string; masterActive:boolean; acquiredOn:string|null; isActive:boolean };
export type WorkerQualificationHolding = { qualificationId:string; code:string; name:string; masterActive:boolean; expiryPolicy:QualificationExpiryPolicy; issuedOn:string|null; validFrom:string|null; expiresOn:string|null; revokedAt:string|null; state:"valid"|"not_yet_valid"|"expired"|"revoked"|"master_inactive" };
export type WorkerCredentialData = { skills:WorkerSkillHolding[]; qualifications:WorkerQualificationHolding[]; skillOptions:SkillMasterItem[]; qualificationOptions:QualificationMasterItem[] };
