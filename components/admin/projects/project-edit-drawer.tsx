"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { AdminFeedback } from "@/components/admin/admin-state";
import { Drawer } from "@/components/admin/drawer";
import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";
import type { ProjectFormOptions } from "@/lib/admin/projects/project-form-types";
import { ProjectForm } from "./form/project-create-form";

export function ProjectEditDrawer({ project, options }: { project: ProjectDetail; options: ProjectFormOptions }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);
  const refreshLatest = useCallback(() => {
    if (pending) return;
    setOpen(false);
    setFormKey((value) => value + 1);
    router.refresh();
  }, [pending, router]);
  const completeSave = useCallback(() => {
    setSaved(true);
    setPending(false);
    setOpen(false);
    setFormKey((value) => value + 1);
    router.refresh();
  }, [router]);

  return <>
    <button type="button" onClick={() => { setSaved(false); setOpen(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Pencil aria-hidden="true" className="size-4" />案件を編集</button>
    {saved && <AdminFeedback kind="success" message="案件を保存しました。" />}
    <Drawer open={open} titleId="project-edit-drawer-title" closeDisabled={pending} onClose={close}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div><h2 id="project-edit-drawer-title" className="text-xl font-semibold text-foreground">案件を編集</h2><p className="mt-1 text-sm text-foreground-muted">案件の基本情報を変更します。</p></div>
        <button type="button" autoFocus aria-label="案件編集を閉じる" disabled={pending} onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-control text-foreground-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:text-foreground-disabled"><X aria-hidden="true" className="size-5" /></button>
      </header>
      {open && <div className="p-4 sm:p-6"><ProjectForm key={formKey} mode="edit" options={options} projectId={project.id} expectedUpdatedAt={project.updatedAt} initialValues={{ name: project.name, branch_id: project.branchId, client_id: project.clientId, start_date: project.startDate, end_date: project.endDate, status: project.status, description: project.description ?? "" }} onCancel={close} onPendingChange={setPending} onSuccess={completeSave} onReloadLatest={refreshLatest} /></div>}
    </Drawer>
  </>;
}
