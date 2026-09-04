"use client";

import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { AdminNavLinks } from "./admin-nav-links";
import { DialogFocusGuard, trapDialogFocus } from "./dialog-focus";

type AdminMobileSidebarProps = {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export function AdminMobileSidebar({
  open,
  onClose,
  triggerRef,
}: AdminMobileSidebarProps) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousPathnameRef = useRef(pathname);
  const scrollPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const root = document.documentElement;
    const scrollPosition = { x: window.scrollX, y: window.scrollY };
    scrollPositionRef.current = scrollPosition;

    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyWidth = body.style.width;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollPosition.y}px`;
    body.style.left = `-${scrollPosition.x}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    return () => {
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.width = previousBodyWidth;
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      window.scrollTo(scrollPosition.x, scrollPosition.y);
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open, triggerRef]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    if (open) onClose();
  }, [open, onClose, pathname]);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches && open) onClose();
    };

    desktopMedia.addEventListener("change", handleDesktopChange);
    return () =>
      desktopMedia.removeEventListener("change", handleDesktopChange);
  }, [open, onClose]);

  function handleDialogClose() {
    if (open) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      id="admin-mobile-navigation"
      aria-labelledby="admin-mobile-navigation-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        trapDialogFocus(event);
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onClose={handleDialogClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-screen max-w-full overflow-hidden bg-surface p-0 text-foreground shadow-overlay backdrop:bg-surface-overlay sm:w-[28rem] open:flex open:flex-col lg:hidden motion-reduce:transition-none"
    >
      <DialogFocusGuard edge="start" />
      <header className="flex h-17 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="min-w-0">
          <h2
            id="admin-mobile-navigation-title"
            className="truncate font-semibold text-slate-950"
          >
            Dispatch OS
          </h2>
          <p className="truncate text-xs text-slate-500">Dispatch Manager</p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="管理画面メニューを閉じる"
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>
      <nav
        aria-label="モバイル管理画面ナビゲーション"
        className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3"
      >
          <AdminNavLinks onNavigate={onClose} />
      </nav>
      <DialogFocusGuard edge="end" />
    </dialog>
  );
}
