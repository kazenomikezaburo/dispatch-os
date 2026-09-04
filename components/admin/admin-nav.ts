import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardClock,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  availability: "implemented" | "placeholder" | "future";
};

export type AdminNavGroup = { label: string; items: readonly AdminNavItem[] };

const future = (label: string, icon: LucideIcon): AdminNavItem => ({ label, icon, availability: "future" });

// Full IA is kept here. Future destinations have no URL; placeholders are not links.
export const adminNavigationGroups: readonly AdminNavGroup[] = [
  { label: "ホーム", items: [{ label: "ホーム", href: "/admin", icon: LayoutDashboard, availability: "implemented" }] },
  { label: "案件・運用", items: [
    { label: "案件", href: "/admin/projects", icon: BriefcaseBusiness, availability: "implemented" },
    { label: "シフト", href: "/admin/shifts", icon: CalendarDays, availability: "implemented" },
    future("配置・休憩回し", Users),
    { label: "前日確認", href: "/admin/pre-shift", icon: ClipboardClock, availability: "implemented" },
    future("当日運用", ClipboardClock),
  ] },
  { label: "勤怠・スタッフ", items: [
    { label: "勤怠", href: "/admin/attendance", icon: ClipboardClock, availability: "implemented" },
    { label: "スタッフ", href: "/admin/workers", icon: Users, availability: "implemented" },
  ] },
  { label: "集計", items: [future("月次勤怠", ClipboardClock), future("交通費", ClipboardClock), future("締め・NEO", ClipboardClock)] },
  { label: "連絡", items: [future("問い合わせ・SOS", Users), future("お知らせ", Users), future("通知", Users)] },
  { label: "ナレッジ", items: [future("FAQ", BriefcaseBusiness), future("マニュアル", BriefcaseBusiness), future("勤務ルール", BriefcaseBusiness)] },
  { label: "マスタ", items: [{ label: "取引先", href: "/admin/clients", icon: Building2, availability: "implemented" }, { label: "勤務先", href: "/admin/workplaces", icon: Building2, availability: "implemented" }] },
  { label: "設定", items: [{ label: "設定", href: "/admin/settings", icon: Settings, availability: "placeholder" }, future("監査ログ", ClipboardClock)] },
];

export const adminNavigation = adminNavigationGroups.flatMap((group) => group.items);
export const visibleAdminNavigationGroups = adminNavigationGroups
  .map((group) => ({ ...group, items: group.items.filter((item) => item.availability !== "future") }))
  .filter((group) => group.items.length > 0);

export function isAdminNavItemActive(pathname: string, href?: string) {
  if (!href) return false;
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
