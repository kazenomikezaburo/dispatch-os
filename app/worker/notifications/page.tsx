import { WorkerNotificationInbox } from "@/components/worker/notifications/worker-notification-inbox";
import { requireWorker } from "@/lib/auth/require-worker";
import { getWorkerNotifications } from "@/lib/worker/notifications/get-worker-notifications";

export default async function WorkerNotificationsPage() {
  const profile = await requireWorker();
  let result: Awaited<ReturnType<typeof getWorkerNotifications>> | null = null;
  try {
    result = await getWorkerNotifications(profile.id);
  } catch (error: unknown) {
    console.error("Failed to load worker notifications", error);
  }
  if (!result) return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><section role="alert" className="rounded-card border border-danger/25 bg-surface p-5"><h1 className="font-semibold">通知を取得できませんでした。</h1><p className="mt-1 text-sm text-foreground-secondary">時間をおいて再度お試しください。</p></section></main>;
  return <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10"><header><p className="text-sm font-semibold text-link">対応状況とお知らせ</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">通知</h1><p className="mt-2 text-sm text-foreground-secondary">Help Requestの対応状況と、管理者からのお知らせを確認できます。</p></header><WorkerNotificationInbox initialNotifications={result.notifications} initialCursor={result.nextCursor} /></main>;
}
