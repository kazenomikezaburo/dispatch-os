"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { adminNavigation, isAdminNavItemActive } from "./admin-nav";

type AdminMobileSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function AdminMobileSidebar({ open, onClose }: AdminMobileSidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="メニューを閉じる" className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="管理画面メニュー" className="relative flex h-full w-[min(20rem,85vw)] flex-col bg-white shadow-xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div><p className="font-semibold text-slate-950">派遣業務OS</p><p className="text-xs text-slate-500">Dispatch Manager</p></div>
          <button type="button" onClick={onClose} aria-label="メニューを閉じる" className="flex size-10 items-center justify-center rounded-md border border-slate-300 text-xl text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">×</button>
        </div>
        <nav aria-label="モバイル管理画面ナビゲーション" className="flex-1 space-y-1 overflow-y-auto p-3">
          {adminNavigation.map((item) => {
            const active = isAdminNavItemActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center rounded-r-md border-l-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${active ? "border-blue-700 bg-blue-50 text-blue-950" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
