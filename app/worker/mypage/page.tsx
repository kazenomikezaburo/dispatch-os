import Link from "next/link";
import { Bell, CalendarClock, MessageCircle } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { requireWorker } from "@/lib/auth/require-worker";

const settings = [
  { href: "/worker/availability", title: "勤務可能日・希望条件", description: "勤務できる日時と希望する働き方を登録します。", icon: CalendarClock },
  { href: "/worker/settings/line", title: "LINE連携", description: "LINE連携状態とリマインダー同意を確認します。", icon: MessageCircle },
  { href: "/worker/notifications", title: "通知", description: "自分宛ての通知と既読状態を確認します。", icon: Bell },
] as const;

export default async function WorkerMyPage() {
  const profile = await requireWorker();
  return <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10"><header><p className="text-sm font-semibold text-link">Worker Settings</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">マイページ</h1><p className="mt-2 text-sm text-foreground-secondary">登録情報と本人向け設定を確認できます。</p></header><section className="mt-7 rounded-card border border-border bg-surface p-5" aria-labelledby="worker-profile"><h2 id="worker-profile" className="text-lg font-semibold">{profile.display_name}さん</h2><p className="mt-1 text-sm text-foreground-secondary">Workerアカウント</p></section><section className="mt-7" aria-labelledby="worker-settings"><h2 id="worker-settings" className="text-lg font-semibold">設定</h2><ul className="mt-4 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">{settings.map(({ href, title, description, icon: Icon }) => <li key={href}><Link href={href} className="flex min-h-20 items-center gap-4 p-4 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring"><Icon aria-hidden className="size-5 shrink-0 text-foreground-muted" /><span className="min-w-0"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-foreground-secondary">{description}</span></span><span aria-hidden className="ml-auto text-foreground-muted">›</span></Link></li>)}</ul></section><form action={logout} className="mt-7"><button type="submit" className="min-h-11 w-full rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:w-auto">ログアウト</button></form></main>;
}
