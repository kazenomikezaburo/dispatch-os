"use client";

import { useEffect } from "react";
import Link from "next/link";
import { adminStateActionClass } from "@/components/admin/admin-state";

const storageKey = "admin-placement-return-focus";

export function PlacementEditorLink({ id, href, children }: { id: string; href: string; children: React.ReactNode }) {
  return <Link id={id} href={href} scroll={false} onClick={() => window.sessionStorage.setItem(storageKey, id)} className={adminStateActionClass}>{children}</Link>;
}

export function PlacementFocusRestore({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const id = window.sessionStorage.getItem(storageKey);
    if (!id) return;
    window.sessionStorage.removeItem(storageKey);
    let attempts = 0;
    const restore = () => {
      const target = document.getElementById(id);
      if (target instanceof HTMLElement) { target.focus(); return; }
      attempts += 1;
      if (attempts < 20) window.setTimeout(restore, 50);
    };
    restore();
  }, [enabled]);
  return null;
}
