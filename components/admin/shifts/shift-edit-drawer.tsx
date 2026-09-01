"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { updateShift } from "@/app/actions/shifts";
import { Drawer } from "@/components/admin/drawer";
import { ShiftForm } from "@/components/admin/projects/shifts/form/shift-create-form";
import type { ShiftFormValues } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftFormOptions } from "@/lib/admin/projects/shift-form-types";
import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";

const tokyoParts = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
};

export function ShiftEditDrawer({ detail }: { detail: AdminShiftDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);
  const start = tokyoParts(detail.startsAt);
  const end = tokyoParts(detail.endsAt);
  const deadline = detail.applicationDeadline ? tokyoParts(detail.applicationDeadline) : { date: "", time: "" };
  const initialValues: ShiftFormValues = { start_date: start.date, start_time: start.time, end_date: end.date, end_time: end.time, required_workers: String(detail.requiredWorkers), break_minutes: detail.breakMinutes === null ? "" : String(detail.breakMinutes), deadline_date: deadline.date, deadline_time: deadline.time, status: detail.status };
  const options: ShiftFormOptions = { project: { id: detail.project.id, name: detail.project.name, status: "recruiting" }, job: { id: detail.job.id, name: detail.job.name, status: "recruiting", workplaceName: detail.workplace.name, hourlyWage: detail.job.hourlyWage, transportationFeeCap: detail.job.transportationFeeCap } };
  const submitAction = async (_projectId: string, _jobId: string, input: unknown) => updateShift(input);
  return <>
    <button type="button" onClick={() => { setConflict(false); setOpen(true); }} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">シフトを編集</button>
    <Drawer open={open} titleId="shift-edit-title" closeDisabled={pending} onClose={close}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-4 py-4 sm:px-6"><div><h2 id="shift-edit-title" className="text-xl font-semibold text-foreground">シフトを編集</h2><p className="mt-1 text-sm text-foreground-secondary">{detail.job.name} · {detail.workplace.name}</p></div><button type="button" autoFocus aria-label="シフト編集を閉じる" disabled={pending} onClick={close} className="flex size-11 items-center justify-center rounded-md text-foreground-secondary hover:bg-background-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"><X aria-hidden="true" className="size-5" /></button></header>
      {open && <div className="p-4 sm:p-6">{conflict && <button type="button" onClick={() => router.refresh()} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-link"><RefreshCw aria-hidden="true" className="size-4" />最新の内容を読み込む</button>}<ShiftForm mode="edit" options={options} initialValues={initialValues} shiftId={detail.id} expectedUpdatedAt={detail.updatedAt} restrictions={detail.editRestrictions} submitAction={submitAction} onConflict={() => setConflict(true)} onCancel={close} onPendingChange={setPending} onSuccess={() => { setPending(false); setOpen(false); router.refresh(); }} /></div>}
    </Drawer>
  </>;
}
