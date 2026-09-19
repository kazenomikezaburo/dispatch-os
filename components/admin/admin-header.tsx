"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { AdminMobileSidebar } from "./admin-mobile-sidebar";

export function AdminHeader({ userMenu }: { userMenu: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-17 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            aria-label={
              mobileOpen
                ? "管理画面メニューを閉じる"
                : "管理画面メニューを開く"
            }
            aria-expanded={mobileOpen}
            aria-controls="admin-mobile-navigation"
            onClick={() => setMobileOpen(true)}
            className="flex size-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-control border border-border-strong text-foreground-secondary hover:bg-surface-hover active:bg-secondary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring lg:hidden"
          >
            <span className="h-0.5 w-4 bg-current" />
            <span className="h-0.5 w-4 bg-current" />
            <span className="h-0.5 w-4 bg-current" />
          </button>
          <p className="truncate text-sm font-semibold text-foreground lg:text-base">
            Dispatch OS
          </p>
        </div>
        {userMenu}
      </header>
      <AdminMobileSidebar
        open={mobileOpen}
        onClose={closeMobile}
        triggerRef={mobileMenuButtonRef}
      />
    </>
  );
}
