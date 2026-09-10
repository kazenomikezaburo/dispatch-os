import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Megaphone } from "lucide-react";
import { logout } from "@/app/actions/auth";
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
  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-surface"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><Link href="/worker" className="min-w-0 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><p className="font-semibold">ワーカーホーム</p><p className="truncate text-sm text-foreground-secondary">こんにちは、{profile.display_name}さん</p></Link><div className="flex items-center gap-2"><Link href="/worker/announcements" aria-label="お知らせ" className="flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Megaphone aria-hidden className="size-5" /></Link><Link href="/worker/notifications" aria-label={unreadCount > 0 ? `通知、未読${unreadCount}件` : "通知"} className="relative flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Bell aria-hidden className="size-5" />{unreadCount > 0 && <span aria-hidden className="absolute -right-1.5 -top-1.5 min-w-5 rounded-pill bg-info px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-foreground-inverse">{badge}</span>}</Link><form action={logout}><button type="submit" className="min-h-11 rounded-control border border-border-strong px-3 text-sm text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:px-4">ログアウト</button></form></div></div></header>{children}</div>;
}
