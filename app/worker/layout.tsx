import type { ReactNode } from "react";
import { WorkerShell } from "@/components/worker/worker-shell";
import { requireWorker } from "@/lib/auth/require-worker";
import { getWorkerUnreadNotificationCount } from "@/lib/worker/notifications/get-worker-notifications";
import { formatWorkerUnreadCount } from "@/lib/worker/notifications/worker-notification-types";

export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const profile = await requireWorker();
  let unreadCount = 0;
  try {
    unreadCount = await getWorkerUnreadNotificationCount(profile.id);
  } catch (error: unknown) {
    console.error("Failed to load worker notification badge", error);
  }
  const badge = formatWorkerUnreadCount(unreadCount);
  return <WorkerShell displayName={profile.display_name} unreadCount={unreadCount} unreadLabel={badge}>{children}</WorkerShell>;
}
