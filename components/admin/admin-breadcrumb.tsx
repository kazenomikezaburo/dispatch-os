"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation, isAdminNavItemActive } from "./admin-nav";

export type AdminBreadcrumbItem = {
  label: string;
  href?: string;
};

export function AdminBreadcrumb({ items }: { items?: readonly AdminBreadcrumbItem[] }) {
  const pathname = usePathname();
  const pageOwnsBreadcrumb =
    /^\/admin\/projects\/[^/]+$/.test(pathname) ||
    /^\/admin\/shifts\/[^/]+$/.test(pathname) ||
    pathname === "/admin/shifts" ||
    pathname === "/admin/pre-shift" ||
    pathname === "/admin/day-of";
  if (!items && pageOwnsBreadcrumb) return null;
  const routeItem = [...adminNavigation]
    .reverse()
    .find((item) => isAdminNavItemActive(pathname, item.href));
  const masterItems = pathname === "/admin/clients"
    ? [{ label: "マスタ", href: "/admin/clients" }, { label: "取引先" }]
    : pathname === "/admin/workplaces"
      ? [{ label: "マスタ", href: "/admin/clients" }, { label: "勤務先" }]
      : undefined;
  const communicationItems = pathname === "/admin/incidents"
    ? [{ label: "連絡", href: "/admin/incidents" }, { label: "ヘルプリクエスト" }]
    : pathname === "/admin/announcements"
      ? [{ label: "連絡", href: "/admin/incidents" }, { label: "お知らせ" }]
      : undefined;
  const resolvedItems = items ?? masterItems ?? communicationItems ?? [{ label: routeItem?.label ?? "管理画面" }];

  return (
    <nav aria-label="パンくずリスト">
      <ol className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-foreground-secondary">
        {resolvedItems.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2 break-words">
            {index > 0 && <span aria-hidden="true" className="text-foreground-disabled">/</span>}
            {item.href && index < resolvedItems.length - 1 ? (
              <Link href={item.href} className="inline-flex min-h-10 items-center font-medium text-link underline-offset-4 hover:text-link-hover hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                {item.label}
              </Link>
            ) : (
              <span aria-current={index === resolvedItems.length - 1 ? "page" : undefined} className={index === resolvedItems.length - 1 ? "font-medium text-foreground" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
