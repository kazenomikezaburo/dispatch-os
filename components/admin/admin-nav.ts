export type AdminNavItem = {
  label: string;
  href: string;
};

export const adminNavigation: readonly AdminNavItem[] = [
  { label: "ダッシュボード", href: "/admin" },
  { label: "案件管理", href: "/admin/projects" },
  { label: "シフト管理", href: "/admin/shifts" },
  { label: "スタッフ管理", href: "/admin/workers" },
  { label: "取引先・勤務先", href: "/admin/clients" },
  { label: "勤怠管理", href: "/admin/attendance" },
  { label: "設定", href: "/admin/settings" },
] as const;

export function isAdminNavItemActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
