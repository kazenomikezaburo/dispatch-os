"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { adminNavigation, isAdminNavItemActive } from "./admin-nav";

export function AdminSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const toggleLabel = collapsed ? "サイドバーを展開する" : "サイドバーを折りたたむ";

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "z-40 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 motion-reduce:transition-none lg:fixed lg:inset-y-0 lg:left-0 lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-slate-200",
          collapsed ? "justify-center px-2" : "px-6",
        )}
      >
        {collapsed ? (
          <span
            aria-label="派遣業務OS"
            className="text-sm font-semibold tracking-tight text-slate-950"
          >
            OS
          </span>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-slate-950">派遣業務OS</p>
            <p className="truncate text-xs text-slate-500">Dispatch Manager</p>
          </div>
        )}
      </div>
      <nav aria-label="管理画面メインナビゲーション" className={cn("flex-1 space-y-1", collapsed ? "p-2" : "p-3")}>
        {adminNavigation.map((item) => {
          const active = isAdminNavItemActive(pathname, item.href);
          const Icon = item.icon;
          const tooltipId = `admin-nav-tooltip-${item.href.replaceAll("/", "-")}`;
          return (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-describedby={collapsed ? tooltipId : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-r-md border-l-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                  collapsed ? "justify-center px-2" : "gap-3 px-4",
                  active
                    ? "border-blue-700 bg-blue-50 font-semibold text-blue-950"
                    : "border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-5 shrink-0", active && "text-blue-700")} />
                <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
              </Link>
              {collapsed && (
                <span
                  id={tooltipId}
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
                >
                  {item.label}
                </span>
              )}
            </div>
          );
        })}
      </nav>
      <div className={cn("shrink-0 border-t border-slate-200", collapsed ? "p-2" : "p-3")}>
        <button
          type="button"
          aria-label={toggleLabel}
          aria-pressed={collapsed}
          onClick={onToggle}
          className={cn(
            "flex min-h-11 w-full items-center rounded-md text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
            collapsed ? "justify-center px-2" : "gap-3 px-4",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5 shrink-0" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-5 shrink-0" />
          )}
          {!collapsed && <span>折りたたむ</span>}
        </button>
      </div>
    </aside>
  );
}
