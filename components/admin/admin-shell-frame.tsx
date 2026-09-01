"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { AdminContentContainer } from "./admin-content-container";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

const SIDEBAR_COOKIE_NAME = "dispatch_admin_sidebar";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function AdminShellFrame({
  children,
  initialCollapsed,
  userMenu,
}: {
  children: ReactNode;
  initialCollapsed: boolean;
  userMenu: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggleSidebar() {
    const next = !collapsed;
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${next ? "collapsed" : "expanded"}; Path=/admin; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
    setCollapsed(next);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <AdminSidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div
        data-sidebar-state={collapsed ? "collapsed" : "expanded"}
        className={cn(
          "min-w-0 transition-[padding-left] duration-200 motion-reduce:transition-none",
          collapsed ? "lg:pl-16" : "lg:pl-60",
        )}
      >
        <AdminHeader userMenu={userMenu} />
        <main className="w-full min-w-0 overflow-x-clip">
          <AdminContentContainer>{children}</AdminContentContainer>
        </main>
      </div>
    </div>
  );
}
