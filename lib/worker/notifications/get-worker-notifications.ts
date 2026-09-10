import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  WorkerNotification,
  WorkerNotificationCursor,
  WorkerNotificationPage,
  WorkerNotificationType,
} from "./worker-notification-types";

const PAGE_SIZE = 20;

type NotificationRow = {
  id: string;
  notification_type: WorkerNotificationType;
  title: string;
  summary: string;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: NotificationRow): WorkerNotification {
  return {
    id: row.id,
    type: row.notification_type,
    title: row.title,
    summary: row.summary,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function getWorkerUnreadNotificationCount(profileId: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("in_app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profileId)
    .is("read_at", null);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

export async function getWorkerNotifications(
  profileId: string,
  cursor: WorkerNotificationCursor | null = null,
): Promise<WorkerNotificationPage> {
  const supabase = await createClient();
  let query = supabase
    .from("in_app_notifications")
    .select("id, notification_type, title, summary, read_at, created_at")
    .eq("recipient_profile_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const result = await query;
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as NotificationRow[];
  const visible = rows.slice(0, PAGE_SIZE);
  const last = visible.at(-1);
  return {
    notifications: visible.map(mapNotification),
    nextCursor:
      rows.length > PAGE_SIZE && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
  };
}

