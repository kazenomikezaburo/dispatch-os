"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createJobInline } from "@/app/actions/jobs";
import { Drawer } from "@/components/admin/drawer";
import type { JobFormOptions } from "@/lib/admin/projects/job-form-types";
import { JobForm } from "./form/job-create-form";

type JobCreateDrawerProps = {
  options?: JobFormOptions;
  createHref: string;
  hasJobs: boolean;
  jobCount: number;
  children?: ReactNode;
};

const triggerClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-blue-700 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function JobCreateDrawer({ options, createHref, hasJobs, jobCount, children }: JobCreateDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);
  const renderTrigger = () => options
    ? <button type="button" onClick={() => setOpen(true)} className={triggerClass}><Plus aria-hidden="true" className="size-4" />業務・勤務先を追加</button>
    : <Link href={createHref} className={triggerClass}><Plus aria-hidden="true" className="size-4" />業務・勤務先を追加</Link>;

  return <section aria-labelledby="jobs-title" className="border-t border-slate-200 pt-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex flex-wrap items-baseline gap-2"><h2 id="jobs-title" className="text-lg font-semibold text-slate-950">業務・勤務先</h2><span className="text-sm font-semibold text-slate-500">{jobCount}件</span></div><p className="mt-1 text-sm text-slate-600">案件に含まれる業務、勤務場所、シフトと配置状況です。</p></div>
      {renderTrigger()}
    </div>
    {hasJobs ? children : <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><p className="font-semibold text-slate-950">業務・勤務先がありません。</p><p className="mt-1 text-sm text-slate-600">この案件で行う業務と勤務先を追加してください。</p><div className="mt-4">{renderTrigger()}</div></div>}
    {options && <Drawer open={open} titleId="job-create-drawer-title" closeDisabled={pending} onClose={close}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div><h2 id="job-create-drawer-title" className="text-xl font-semibold text-slate-950">業務・勤務先を追加</h2><p className="mt-1 text-sm text-slate-600">{options.project.name}に新しい業務と勤務先を追加します。</p></div>
        <button type="button" autoFocus aria-label="業務・勤務先追加を閉じる" disabled={pending} onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"><X aria-hidden="true" className="size-5" /></button>
      </header>
      <div className="p-4 sm:p-6"><JobForm key={formKey} options={options} submitAction={createJobInline} onCancel={close} onPendingChange={setPending} onSuccess={() => { setFormKey((value) => value + 1); setOpen(false); router.refresh(); }} /></div>
    </Drawer>}
  </section>;
}
