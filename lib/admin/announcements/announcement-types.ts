export const ANNOUNCEMENT_STATES = ["draft", "published", "archived"] as const;
export const ANNOUNCEMENT_IMPORTANCE = ["normal", "important"] as const;
export const ANNOUNCEMENT_SCOPES = ["organization", "branch"] as const;

export type AnnouncementState = (typeof ANNOUNCEMENT_STATES)[number];
export type AnnouncementImportance = (typeof ANNOUNCEMENT_IMPORTANCE)[number];
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

export type AdminAnnouncement = {
  id: string;
  state: AnnouncementState;
  version: number;
  scopeType: AnnouncementScope;
  branchId: string | null;
  branchName: string | null;
  title: string;
  body: string;
  importance: AnnouncementImportance;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  recipientCount: number;
};

export type AnnouncementBranch = { id: string; name: string };
export type AnnouncementActor = { accountType: "manager" | "system_admin"; branches: AnnouncementBranch[] };
export type AnnouncementFilter = "all" | AnnouncementState;

