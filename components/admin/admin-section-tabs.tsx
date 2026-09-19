"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  adminNavigationTabActiveClass,
  adminNavigationTabBaseClass,
  adminWorkspaceTabClass,
} from "@/components/admin/admin-navigation-tab-styles";

export type AdminSectionTab = {
  label: string;
  href: string;
};

export function AdminSectionTabs({ label, items }: { label: string; items: readonly AdminSectionTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const current = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                adminNavigationTabBaseClass,
                adminWorkspaceTabClass,
                current && adminNavigationTabActiveClass,
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
