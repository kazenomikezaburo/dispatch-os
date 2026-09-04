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
  const routeItem = [...adminNavigation]
    .reverse()
    .find((item) => isAdminNavItemActive(pathname, item.href));
  const resolvedItems = items ?? [{ label: routeItem?.label ?? "管理画面" }];

  return (
    <nav aria-label="パンくずリスト">
      <ol className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-foreground-secondary">
        {resolvedItems.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2 break-words">
            {index > 0 && <span aria-hidden="true" className="text-slate-400">/</span>}
            {item.href && index < resolvedItems.length - 1 ? (
              <Link href={item.href} className="inline-flex min-h-10 items-center font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                {item.label}
              </Link>
            ) : (
              <span aria-current={index === resolvedItems.length - 1 ? "page" : undefined} className={index === resolvedItems.length - 1 ? "font-medium text-slate-900" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
