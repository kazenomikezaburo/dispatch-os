export type WorkerAnnouncementImportance = "normal" | "important";

export type WorkerAnnouncementSummary = {
  id: string;
  title: string;
  importance: WorkerAnnouncementImportance;
  publishedAt: string;
};

export type WorkerAnnouncementDetail = WorkerAnnouncementSummary & {
  body: string;
};

export type WorkerAnnouncementCursor = {
  publishedAt: string;
  id: string;
};

export type WorkerAnnouncementPage = {
  announcements: WorkerAnnouncementSummary[];
  nextCursor: WorkerAnnouncementCursor | null;
};
