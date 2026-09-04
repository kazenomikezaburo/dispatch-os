"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isAdminNavItemActive, visibleAdminNavigationGroups } from "./admin-nav";

export function AdminNavLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <div className="space-y-4">
    {visibleAdminNavigationGroups.map((group) => <div key={group.label} className="space-y-1">
      {group.label !== "ホーム" && <p className={collapsed ? "sr-only" : "px-3 pb-1 text-xs font-medium text-foreground-muted"}>{group.label}</p>}
      {group.items.map((item) => {
        const Icon = item.icon;
        const active = Boolean(item.href && isAdminNavItemActive(pathname, item.href));
        const label = item.availability === "implemented" ? item.label : `${item.label}（準備中）`;
        const content = <><Icon aria-hidden="true" className="size-5 shrink-0" /><span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>{item.label}</span>{!collapsed && item.availability !== "implemented" && <span className="text-xs">準備中</span>}</>;
        const className = cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium", collapsed && "justify-center px-2", active ? "bg-surface-selected text-link" : "text-foreground-secondary");
        return <div key={item.label} className="group relative">
          {item.availability === "implemented" && item.href ? <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} aria-label={label} className={cn(className, "hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring")}>{content}</Link> : <span aria-disabled="true" aria-label={label} className={cn(className, "cursor-not-allowed text-foreground-muted")}>{content}</span>}
          {collapsed && <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-foreground px-3 py-2 text-xs text-foreground-inverse opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">{label}</span>}
        </div>;
      })}
    </div>)}
  </div>;
}
