"use client";

import { usePathname } from "next/navigation";
import { adminNavigation, isAdminNavItemActive } from "./admin-nav";

export type AdminBreadcrumbItem = {
  label: string;
};

export function AdminBreadcrumb({ items }: { items?: readonly AdminBreadcrumbItem[] }) {
  const pathname = usePathname();
  const routeItem = [...adminNavigation]
    .reverse()
    .find((item) => isAdminNavItemActive(pathname, item.href));
  const resolvedItems = items ?? [{ label: routeItem?.label ?? "管理画面" }];

  return (
    <nav aria-label="パンくずリスト">
      <ol className="flex items-center gap-2 text-sm text-slate-600">
        {resolvedItems.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true" className="text-slate-400">/</span>}
            <span aria-current={index === resolvedItems.length - 1 ? "page" : undefined} className={index === resolvedItems.length - 1 ? "font-medium text-slate-900" : undefined}>
              {item.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
