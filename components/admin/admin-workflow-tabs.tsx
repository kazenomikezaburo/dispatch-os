"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  adminWorkflowTabs,
  getActiveAdminWorkflowHref,
} from "./admin-workflow-tabs-config";
import {
  adminNavigationTabActiveClass,
  adminNavigationTabBaseClass,
  adminWorkflowTabClass,
} from "./admin-navigation-tab-styles";

export function AdminWorkflowTabs() {
  const pathname = usePathname();
  const activeHref = getActiveAdminWorkflowHref(pathname);

  if (!activeHref) return null;

  return (
    <nav aria-label="案件・運用ワークフロー" className="overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1">
        {adminWorkflowTabs.map((item) => {
          const active = item.href === activeHref;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                adminNavigationTabBaseClass,
                adminWorkflowTabClass,
                active && adminNavigationTabActiveClass,
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
