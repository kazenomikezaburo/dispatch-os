"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AdminNavLinks } from "./admin-nav-links";

export function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const toggleLabel = collapsed ? "サイドバーを展開する" : "サイドバーを折りたたむ";
  return <aside data-collapsed={collapsed} className={cn("z-40 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 motion-reduce:transition-none lg:fixed lg:inset-y-0 lg:left-0 lg:flex", collapsed ? "w-18" : "w-60")}>
    <div className={cn("flex h-17 shrink-0 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-6")}>
      {collapsed ? <span aria-label="Dispatch OS" className="text-sm font-semibold">OS</span> : <div className="min-w-0"><p className="truncate text-base font-semibold">Dispatch OS</p><p className="text-xs text-foreground-muted">管理者メニュー</p></div>}
    </div>
    <nav aria-label="管理画面メインナビゲーション" className={cn("flex-1", collapsed ? "p-2" : "overflow-y-auto p-3")}><AdminNavLinks collapsed={collapsed} /></nav>
    <div className="shrink-0 border-t border-border p-2"><button type="button" aria-label={toggleLabel} aria-pressed={collapsed} onClick={onToggle} className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring", collapsed && "justify-center")}>
      {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-5" /> : <PanelLeftClose aria-hidden="true" className="size-5" />}{!collapsed && "折りたたむ"}
    </button></div>
  </aside>;
}
