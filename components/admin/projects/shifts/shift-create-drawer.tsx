"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createShiftInline } from "@/app/actions/shifts";
import { Drawer } from "@/components/admin/drawer";
import type { ShiftFormOptions } from "@/lib/admin/projects/shift-form-types";
import { ShiftForm } from "./form/shift-create-form";

type ShiftCreateDrawerProps = {
  options?: ShiftFormOptions;
  createHref: string;
};

const triggerClass = "inline-flex min-h-11 items-center rounded-md border border-blue-700 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function ShiftCreateDrawer({ options, createHref }: ShiftCreateDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);

  if (!options) return <Link href={createHref} className={triggerClass}>シフトを追加</Link>;
  const titleId = `shift-create-drawer-title-${options.job.id}`;

  return <>
    <button type="button" onClick={() => { setPending(false); setOpen(true); }} className={triggerClass}>シフトを追加</button>
    <Drawer open={open} titleId={titleId} closeDisabled={pending} onClose={close}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div><h2 id={titleId} className="text-xl font-semibold text-slate-950">シフトを追加</h2><p className="mt-1 font-semibold text-slate-800">{options.job.name}</p><p className="mt-1 text-sm text-slate-600">{options.job.workplaceName} · {options.project.name}</p></div>
        <button type="button" autoFocus aria-label="シフト追加を閉じる" disabled={pending} onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"><X aria-hidden="true" className="size-5" /></button>
      </header>
      {open && <div className="p-4 sm:p-6"><ShiftForm options={options} showContext={false} submitAction={createShiftInline} onCancel={close} onPendingChange={setPending} onSuccess={() => { setPending(false); setOpen(false); router.refresh(); }} /></div>}
    </Drawer>
  </>;
}
