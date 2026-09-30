import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { requireWorker } from "@/lib/auth/require-worker";
import { getWorkerNotificationEntry } from "@/lib/worker/notifications/get-worker-notification-entry";

export default async function WorkerNotificationEntryPage({ params }: { params: Promise<{ notificationId: string }> }) {
  await requireWorker();
  const { notificationId } = await params;
  const notification = await getWorkerNotificationEntry(notificationId);
  if (!notification) return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><section className="rounded-card border border-border bg-surface p-5"><h1 className="font-semibold">通知を表示できません</h1><p className="mt-2 text-sm text-foreground-secondary">通知が存在しないか、このアカウントでは表示できません。</p><Link href="/worker/notifications" className="mt-4 inline-flex min-h-11 items-center font-semibold text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">通知一覧へ戻る</Link></section></main>;
  const sourceHref = notification.sourceId
    ? notification.sourceKind === "announcement" ? `/worker/announcements/${notification.sourceId}` : `/worker/assignments/${notification.sourceId}`
    : null;
  return <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10"><header><p className="text-sm font-semibold text-link">通知</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{notification.title}</h1></header><section className="mt-6 rounded-card border border-border bg-surface p-5 sm:p-6"><div className="flex items-start gap-3"><Bell aria-hidden className="mt-0.5 size-5 shrink-0 text-info" /><div><p className="whitespace-pre-wrap text-sm leading-7 text-foreground-secondary">{notification.summary}</p><time dateTime={notification.createdAt} className="mt-3 block text-xs text-foreground-muted">{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time></div></div></section><section className="mt-5 rounded-card border border-border bg-surface p-5 sm:p-6"><h2 className="font-semibold">関連情報</h2>{sourceHref ? <Link href={sourceHref} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:w-auto">{notification.sourceKind === "announcement" ? "お知らせを確認する" : "勤務詳細を確認する"}<ChevronRight aria-hidden className="size-4" /></Link> : <p aria-disabled="true" className="mt-3 rounded-control bg-surface-muted p-3 text-sm text-foreground-secondary">関連情報は現在表示できません。</p>}</section></main>;
}
