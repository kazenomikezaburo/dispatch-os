"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { AdminBreadcrumb } from "./admin-breadcrumb";
import { AdminMobileSidebar } from "./admin-mobile-sidebar";

export function AdminHeader({ userMenu }: { userMenu: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" aria-label="管理画面メニューを開く" aria-expanded={mobileOpen} aria-controls="admin-mobile-navigation" onClick={() => setMobileOpen(true)} className="flex size-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border border-slate-300 text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:hidden">
            <span className="h-0.5 w-4 bg-current" /><span className="h-0.5 w-4 bg-current" /><span className="h-0.5 w-4 bg-current" />
          </button>
          <AdminBreadcrumb />
        </div>
        {userMenu}
      </header>
      <div id="admin-mobile-navigation"><AdminMobileSidebar open={mobileOpen} onClose={closeMobile} /></div>
    </>
  );
}
