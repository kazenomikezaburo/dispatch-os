"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, CircleHelp, Home, Search, UserRound } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { getWorkerActiveNav, type WorkerNavKey } from "@/components/worker/worker-nav-routes";

type Props = {
  children: ReactNode;
  displayName: string;
  unreadCount: number;
  unreadLabel: string;
};

const navItems = [
  { key: "home", href: "/worker", label: "ホーム", icon: Home },
  { key: "recruitment", href: "/worker/recruitment", label: "募集", icon: Search },
  { key: "shifts", href: "/worker/shifts", label: "勤務", icon: CalendarDays },
  { key: "support", href: "/worker/support", label: "サポート", icon: CircleHelp },
  { key: "mypage", href: "/worker/mypage", label: "マイページ", icon: UserRound },
] as const satisfies ReadonlyArray<{ key: WorkerNavKey; href: string; label: string; icon: typeof Home }>;

const pageTitles: Record<WorkerNavKey, string> = {
  home: "ホーム",
  recruitment: "募集",
  shifts: "勤務",
  support: "サポート",
  mypage: "マイページ",
};

function NotificationLink({ unreadCount, unreadLabel }: Pick<Props, "unreadCount" | "unreadLabel">) {
  return <Link href="/worker/notifications" aria-label={unreadCount > 0 ? `通知、未読${unreadCount}件` : "通知"} className="relative flex size-11 shrink-0 items-center justify-center rounded-control text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Bell aria-hidden className="size-[22px]" />{unreadCount > 0 && <span aria-hidden className="absolute right-1 top-1 min-w-4 rounded-pill bg-info px-1 text-center text-[10px] font-bold leading-4 text-foreground-inverse">{unreadLabel}</span>}</Link>;
}

function DesktopNavigation({ active }: { active: WorkerNavKey | null }) {
  return <nav aria-label="Workerメインナビゲーション" className="mt-5 flex flex-col gap-1 px-3">{navItems.map(({ key, href, label, icon: Icon }) => {
    const selected = active === key;
    return <Link key={key} href={href} aria-current={selected ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${selected ? "bg-surface-selected font-semibold text-link" : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"}`}><Icon aria-hidden className="size-5" /><span>{label}</span></Link>;
  })}</nav>;
}

function MobileNavigation({ active }: { active: WorkerNavKey | null }) {
  return <nav aria-label="Workerメインナビゲーション" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface md:hidden"><div className="mx-auto grid h-[calc(74px+env(safe-area-inset-bottom))] max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">{navItems.map(({ key, href, label, icon: Icon }) => {
    const selected = active === key;
    return <Link key={key} href={href} aria-current={selected ? "page" : undefined} className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 px-0.5 pt-1 text-[10px] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring ${selected ? "font-semibold text-link" : "text-foreground-muted hover:text-foreground"}`}>{selected && <span aria-hidden className="absolute inset-x-2.5 top-0 h-[3px] rounded-b bg-info" />}<Icon aria-hidden className="size-[22px]" /><span className="w-full truncate text-center">{label}</span></Link>;
  })}</div></nav>;
}

export function WorkerShell({ children, displayName, unreadCount, unreadLabel }: Props) {
  const pathname = usePathname();
  const active = getWorkerActiveNav(pathname);
  const title = active ? pageTitles[active] : pathname.startsWith("/worker/notifications") ? "通知" : pathname.startsWith("/worker/announcements") ? "お知らせ" : "OpsCue";

  return <div className="min-h-screen min-w-0 bg-background md:pl-60">
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 border-r border-border bg-surface md:flex md:flex-col">
      <Link href="/worker" className="flex h-[72px] shrink-0 items-center border-b border-border px-6 text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring">OpsCue</Link>
      <DesktopNavigation active={active} />
      <div className="mt-auto border-t border-border p-4"><p className="truncate text-sm font-semibold">{displayName}さん</p><p className="mt-0.5 text-xs text-foreground-muted">Worker</p><form action={logout} className="mt-3"><button type="submit" className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm font-medium text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">ログアウト</button></form></div>
    </aside>
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex h-16 min-w-0 items-center justify-between gap-3 px-4 md:h-[72px] md:px-8">
        <Link href="/worker" className="min-w-0 truncate rounded-control text-[17px] font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring md:hidden">OpsCue</Link>
        <p className="hidden truncate text-2xl font-semibold tracking-tight md:block">{title}</p>
        <NotificationLink unreadCount={unreadCount} unreadLabel={unreadLabel} />
      </div>
    </header>
    <div className="min-w-0 pb-[calc(74px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
    <MobileNavigation active={active} />
  </div>;
}
