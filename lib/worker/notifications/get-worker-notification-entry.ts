import "server-only";

import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/utils/uuid-schema";
import type { WorkerNotificationType } from "@/lib/worker/notifications/worker-notification-types";

type RpcObject = Record<string, unknown>;

export type WorkerNotificationEntry = {
  id: string;
  type: WorkerNotificationType;
  title: string;
  summary: string;
  createdAt: string;
  sourceKind: "assignment" | "announcement";
  sourceId: string | null;
  sourceStatus: "available" | "unavailable";
};

export async function getWorkerNotificationEntry(notificationId: string): Promise<WorkerNotificationEntry | null> {
  const parsedId = uuidSchema.safeParse(notificationId);
  if (!parsedId.success) return null;
  const supabase = await createClient();
  const notification = await supabase.from("in_app_notifications")
    .select("id,notification_type,title,summary,created_at")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (notification.error || !notification.data) return null;

  const type = notification.data.notification_type as WorkerNotificationType;
  const isAnnouncement = type === "announcement_published";
  const isPreConfirmation = type === "pre_confirmation_reminder";
  const isJourney = type === "wake_reminder" || type === "departure_reminder" || type === "arrival_reminder";
  const resolver = isAnnouncement
    ? "resolve_announcement_notification_source_context"
    : isPreConfirmation
      ? "resolve_pre_confirmation_reminder_source_context"
      : isJourney
        ? "resolve_worker_journey_reminder_source_context"
        : "resolve_in_app_notification_source_context";
  const source = await supabase.rpc(resolver, { p_notification_id: parsedId.data });
  const result = source.data && typeof source.data === "object" && !Array.isArray(source.data)
    ? source.data as RpcObject
    : null;
  const sourceId = uuidSchema.safeParse(isAnnouncement ? result?.announcement_id : result?.assignment_id);
  const available = !source.error && result?.ok === true && result.source_available === true && sourceId.success;
  return {
    id: notification.data.id,
    type,
    title: notification.data.title,
    summary: notification.data.summary,
    createdAt: notification.data.created_at,
    sourceKind: isAnnouncement ? "announcement" : "assignment",
    sourceId: available ? sourceId.data : null,
    sourceStatus: available ? "available" : "unavailable",
  };
}
