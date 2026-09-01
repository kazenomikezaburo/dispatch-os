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
  href: string;
  icon: LucideIcon;
};

export const adminNavigation: readonly AdminNavItem[] = [
  { label: "ダッシュボード", href: "/admin", icon: LayoutDashboard },
  { label: "案件管理", href: "/admin/projects", icon: BriefcaseBusiness },
  { label: "シフト管理", href: "/admin/shifts", icon: CalendarDays },
  { label: "スタッフ管理", href: "/admin/workers", icon: Users },
  { label: "取引先・勤務先", href: "/admin/clients", icon: Building2 },
  { label: "勤怠管理", href: "/admin/attendance", icon: ClipboardClock },
  { label: "設定", href: "/admin/settings", icon: Settings },
] as const;

export function isAdminNavItemActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
