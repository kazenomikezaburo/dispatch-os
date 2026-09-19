export const adminWorkflowTabs = [
  { label: "案件", href: "/admin/projects" },
  { label: "シフト", href: "/admin/shifts" },
  { label: "配置・休憩", href: "/admin/placement" },
  { label: "前日確認", href: "/admin/shifts/pre-shift" },
  { label: "当日運用", href: "/admin/shifts/day-of" },
] as const;

export function getActiveAdminWorkflowHref(pathname: string) {
  return adminWorkflowTabs.find((item) => item.href === pathname)?.href ?? null;
}
