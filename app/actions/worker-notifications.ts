"use server";

import { requireWorker } from "@/lib/auth/require-worker";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/utils/uuid-schema";
import { getWorkerNotifications } from "@/lib/worker/notifications/get-worker-notifications";
import type { WorkerNotificationCursor } from "@/lib/worker/notifications/worker-notification-types";

type RpcObject = Record<string, unknown>;

function objectResult(value: unknown): RpcObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RpcObject)
    : null;
}

export async function openWorkerNotification(notificationId: string) {
  const id = uuidSchema.safeParse(notificationId);
  if (!id.success) return { ok: false as const, message: "お知らせを開けませんでした。" };
  const profile = await requireWorker();
  const supabase = await createClient();

  const read = await supabase.rpc("mark_in_app_notification_read", {
    p_notification_id: id.data,
  });
  const readResult = objectResult(read.data);
  if (read.error || readResult?.ok !== true) {
    return { ok: false as const, message: "お知らせを開けませんでした。時間をおいて再度お試しください。" };
  }

  const notification = await supabase
    .from("in_app_notifications")
    .select("notification_type")
    .eq("id", id.data)
    .eq("recipient_profile_id", profile.id)
    .maybeSingle();
  if (notification.error || !notification.data) {
    return {
      ok: true as const,
      readAt: typeof readResult.read_at === "string" ? readResult.read_at : new Date().toISOString(),
      sourceKind: null,
      sourceId: null,
      sourceStatus: "error" as const,
    };
  }

  const isAnnouncement = notification.data.notification_type === "announcement_published";
  const source = await supabase.rpc(isAnnouncement
    ? "resolve_announcement_notification_source_context"
    : "resolve_in_app_notification_source_context", {
    p_notification_id: id.data,
  });
  const sourceResult = objectResult(source.data);
  if (source.error || sourceResult?.ok !== true) {
    return {
      ok: true as const,
      readAt: typeof readResult.read_at === "string" ? readResult.read_at : new Date().toISOString(),
      sourceKind: isAnnouncement ? "announcement" as const : "assignment" as const,
      sourceId: null,
      sourceStatus: "error" as const,
    };
  }

  const sourceId = uuidSchema.safeParse(isAnnouncement
    ? sourceResult.announcement_id
    : sourceResult.assignment_id);
  return {
    ok: true as const,
    readAt: typeof readResult.read_at === "string" ? readResult.read_at : new Date().toISOString(),
    sourceKind: isAnnouncement ? "announcement" as const : "assignment" as const,
    sourceId:
      sourceResult.source_available === true && sourceId.success
        ? sourceId.data
        : null,
    sourceStatus:
      sourceResult.source_available === true && sourceId.success
        ? "available" as const
        : "unavailable" as const,
  };
}

export async function loadMoreWorkerNotifications(cursor: WorkerNotificationCursor) {
  const id = uuidSchema.safeParse(cursor?.id);
  const createdAt = typeof cursor?.createdAt === "string" ? Date.parse(cursor.createdAt) : Number.NaN;
  if (!id.success || !Number.isFinite(createdAt)) {
    return { ok: false as const, message: "お知らせを追加で読み込めませんでした。" };
  }
  const profile = await requireWorker();
  try {
    const page = await getWorkerNotifications(profile.id, {
      id: id.data,
      createdAt: new Date(createdAt).toISOString(),
    });
    return { ok: true as const, page };
  } catch (error: unknown) {
    console.error("Failed to load more worker notifications", error);
    return { ok: false as const, message: "お知らせを追加で読み込めませんでした。" };
  }
}
