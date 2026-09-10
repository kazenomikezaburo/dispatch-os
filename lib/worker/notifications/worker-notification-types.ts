export type WorkerNotificationType = "incident_acknowledged" | "incident_resolved" | "announcement_published";

export type WorkerNotification = {
  id: string;
  type: WorkerNotificationType;
  title: string;
  summary: string;
  readAt: string | null;
  createdAt: string;
};

export type WorkerNotificationCursor = {
  createdAt: string;
  id: string;
};

export type WorkerNotificationPage = {
  notifications: WorkerNotification[];
  nextCursor: WorkerNotificationCursor | null;
};

export function formatWorkerUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}
