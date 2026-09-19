"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export const shiftOperationTabs = [
  { label: "シフト", href: "/admin/shifts" },
  { label: "前日確認", href: "/admin/shifts/pre-shift" },
  { label: "当日確認", href: "/admin/shifts/day-of" },
] as const;

export function ShiftOperationsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="シフト運用" className="overflow-x-auto rounded-control border border-border bg-surface p-1">
      <div className="flex min-w-max gap-1">
        {shiftOperationTabs.map((item) => {
          const active = item.href === "/admin/shifts"
            ? pathname === item.href || pathname === "/admin/shifts/new"
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-control px-5 text-sm font-medium text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                active && "bg-surface-selected font-semibold text-link shadow-sm",
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
