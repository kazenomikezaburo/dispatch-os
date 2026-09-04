"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { DialogFocusGuard, trapDialogFocus } from "./dialog-focus";

type DrawerProps = {
  open: boolean;
  titleId: string;
  closeDisabled?: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, titleId, closeDisabled = false, onClose, children }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }} onKeyDown={(event) => { trapDialogFocus(event); if (event.key === "Escape") { event.preventDefault(); if (!closeDisabled) onClose(); } }} onClick={(event) => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }} className="fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-none w-full max-w-3xl overflow-y-auto border-l border-border bg-surface p-0 text-foreground shadow-ds-overlay backdrop:bg-[var(--surface-overlay)] open:flex open:flex-col">
    <DialogFocusGuard edge="start" />
    {children}
    <DialogFocusGuard edge="end" />
  </dialog>;
}
