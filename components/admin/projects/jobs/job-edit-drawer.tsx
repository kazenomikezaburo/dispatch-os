"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Drawer } from "@/components/admin/drawer";
import type { ProjectDetailJob } from "@/lib/admin/projects/project-detail-types";
import type { JobFormOptions } from "@/lib/admin/projects/job-form-types";
import { JobForm } from "./form/job-create-form";

export function JobEditDrawer({ job, options }: { job: ProjectDetailJob; options: JobFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);
  const reloadLatest = useCallback(() => { if (pending) return; setOpen(false); setFormKey((value) => value + 1); router.refresh(); }, [pending, router]);
  const complete = useCallback(() => { setPending(false); setOpen(false); setFormKey((value) => value + 1); router.refresh(); }, [router]);
  const editOptions = options.workplaces.some((workplace) => workplace.id === job.workplace.id) ? options : { ...options, workplaces: [job.workplace, ...options.workplaces] };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Pencil aria-hidden="true" className="size-4" />編集</button>
    <Drawer open={open} titleId={`job-edit-drawer-title-${job.id}`} closeDisabled={pending} onClose={close}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div><h2 id={`job-edit-drawer-title-${job.id}`} className="text-xl font-semibold text-foreground">業務・勤務先を編集</h2><p className="mt-1 text-sm text-foreground-muted">{job.name}の業務情報を変更します。</p></div>
        <button type="button" autoFocus aria-label="業務編集を閉じる" disabled={pending} onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-control text-foreground-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:text-foreground-disabled"><X aria-hidden="true" className="size-5" /></button>
      </header>
      {open && <div className="p-4 sm:p-6"><JobForm key={formKey} mode="edit" options={editOptions} jobId={job.id} expectedUpdatedAt={job.updatedAt} canEditWorkplace={job.canEditWorkplace} canEditCompensation={job.canEditCompensation} initialValues={{ name: job.name, workplace_id: job.workplace.id, status: job.status, description: job.description ?? "", hourly_wage: job.hourlyWage ?? "", transportation_fee_cap: job.transportationFeeCap ?? "", dress_code: job.dressCode ?? "", requirements: job.requirements ?? "", meal_notes: job.mealNotes ?? "", recruitment_notes: job.recruitmentNotes ?? "", manual_url: job.manualUrl ?? "" }} onCancel={close} onPendingChange={setPending} onSuccess={complete} onReloadLatest={reloadLatest} /></div>}
    </Drawer>
  </>;
}
