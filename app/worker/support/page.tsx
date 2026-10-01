import Link from "next/link";
import { Bell, CalendarDays, Megaphone, TriangleAlert } from "lucide-react";
import { requireWorker } from "@/lib/auth/require-worker";

const links = [
  { href: "/worker/shifts", title: "勤務中のトラブル・問い合わせ", description: "対象の勤務詳細からSOS・問い合わせを送信できます。", icon: TriangleAlert },
  { href: "/worker/announcements", title: "お知らせ", description: "運営から公開された案内を確認します。", icon: Megaphone },
  { href: "/worker/notifications", title: "通知", description: "自分宛てのリマインダーや対応状況を確認します。", icon: Bell },
] as const;

export default async function WorkerSupportPage() {
  await requireWorker();
  return <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10"><header><p className="text-sm font-semibold text-link">Worker Support</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">サポート</h1><p className="mt-2 text-sm text-foreground-secondary">勤務で困ったときの連絡先と確認方法です。</p></header><section className="mt-7" aria-labelledby="support-links"><h2 id="support-links" className="text-lg font-semibold">利用できるサポート</h2><ul className="mt-4 grid gap-3">{links.map(({ href, title, description, icon: Icon }) => <li key={href}><Link href={href} className="flex min-h-20 items-center gap-4 rounded-card border border-border bg-surface p-4 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-info-subtle text-info"><Icon aria-hidden className="size-5" /></span><span className="min-w-0"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-foreground-secondary">{description}</span></span><span aria-hidden className="ml-auto text-foreground-muted">›</span></Link></li>)}</ul></section><section className="mt-7 rounded-card border border-border bg-surface p-5"><div className="flex items-center gap-2"><CalendarDays aria-hidden className="size-5 text-foreground-muted" /><h2 className="font-semibold">勤務固有の連絡について</h2></div><p className="mt-2 text-sm leading-6 text-foreground-secondary">SOS・問い合わせは対象の勤務と結び付けて記録します。勤務一覧から対象の勤務詳細を開いてください。</p><Link href="/worker/shifts" className="mt-4 inline-flex min-h-11 items-center font-semibold text-link hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">勤務一覧へ</Link></section></main>;
}
