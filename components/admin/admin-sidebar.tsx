"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation, isAdminNavItemActive } from "./admin-nav";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
      <div className="flex h-16 shrink-0 flex-col justify-center border-b border-slate-200 px-6">
        <p className="text-base font-semibold tracking-tight text-slate-950">派遣業務OS</p>
        <p className="text-xs text-slate-500">Dispatch Manager</p>
      </div>
      <nav aria-label="管理画面メインナビゲーション" className="flex-1 space-y-1 overflow-y-auto p-3">
        {adminNavigation.map((item) => {
          const active = isAdminNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-r-md border-l-2 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                active
                  ? "border-blue-700 bg-blue-50 text-blue-950"
                  : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
