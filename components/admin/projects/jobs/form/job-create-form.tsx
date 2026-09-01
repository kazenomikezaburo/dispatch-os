"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { createJob, updateJob } from "@/app/actions/jobs";
import { JOB_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import { JOB_STATUSES, jobFormSchema, type JobFormInput, type JobFormValues } from "@/lib/admin/projects/job-form-schema";
import type { JobFormOptions } from "@/lib/admin/projects/job-form-types";
import type { JobUpdateInput } from "@/lib/admin/projects/job-update-schema";
import { JobFormError } from "./job-form-error";

const controlClass = "mt-1.5 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus-ring focus:ring-2 focus:ring-info-subtle disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-foreground-disabled";
type JobFormProps = {
  options: JobFormOptions;
  mode?: "create" | "edit";
  initialValues?: Partial<JobFormValues>;
  jobId?: string;
  expectedUpdatedAt?: string;
  canEditWorkplace?: boolean;
  canEditCompensation?: boolean;
  cancelHref?: string;
  onCancel?: () => void;
  submitLabel?: string;
  pendingLabel?: string;
  submitAction?: typeof createJob;
  onSuccess?: () => void;
  onPendingChange?: (pending: boolean) => void;
  onReloadLatest?: () => void;
};

export function JobForm({ options, mode = "create", initialValues, jobId, expectedUpdatedAt, canEditWorkplace = true, canEditCompensation = true, cancelHref, onCancel, submitLabel = mode === "edit" ? "変更を保存" : "業務を追加", pendingLabel = mode === "edit" ? "保存中..." : "業務を追加中...", submitAction = createJob, onSuccess, onPendingChange, onReloadLatest }: JobFormProps) {
  const defaultStatus = options.project.status === "draft" ? "draft" : "recruiting";
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<JobFormValues, unknown, JobFormInput>({ resolver: zodResolver(jobFormSchema), defaultValues: { name: "", workplace_id: options.workplaces[0]?.id ?? "", status: defaultStatus, description: "", hourly_wage: "", transportation_fee_cap: "", dress_code: "", requirements: "", meal_notes: "", recruitment_notes: "", manual_url: "", ...initialValues } });
  useEffect(() => { onPendingChange?.(isSubmitting); }, [isSubmitting, onPendingChange]);
  const submit = handleSubmit(async (values) => {
    onPendingChange?.(true);
    try {
      if (mode === "create") {
        const result = await submitAction(options.project.id, values);
        if (result.ok) { reset(); onSuccess?.(); return; }
        if (result.fieldErrors) for (const [field, fieldMessage] of Object.entries(result.fieldErrors)) if (fieldMessage) setError(field as keyof JobFormValues, { message: fieldMessage });
        if (result.message) setError("root", { message: result.message });
        return;
      }
      if (!jobId || !expectedUpdatedAt) { setError("root", { message: "編集情報を確認できませんでした。最新の内容を読み込んでください。" }); return; }
      const payload: JobUpdateInput = { id: jobId, expectedUpdatedAt, ...values };
      const result = await updateJob(payload);
      if (result.ok) { onSuccess?.(); return; }
      if (result.type === "validation" && result.fieldErrors) for (const [field, fieldMessage] of Object.entries(result.fieldErrors)) if (fieldMessage) setError(field as keyof JobFormValues, { message: fieldMessage });
      setError("root", { message: result.message });
    } finally { onPendingChange?.(false); }
  });
  const message = (field: keyof JobFormValues) => errors[field]?.message as string | undefined;
  const disabled = mode === "create" && options.workplaces.length === 0;
  return <form onSubmit={submit} noValidate className="space-y-5 rounded-panel border border-border bg-surface p-4 sm:p-6">
    {errors.root?.message && mode === "edit" && errors.root.message.includes("更新されています") ? <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">他の管理者によって業務情報が更新されています。最新の内容を読み込んでください。</p>{onReloadLatest && <button type="button" onClick={onReloadLatest} className="mt-3 inline-flex min-h-11 items-center font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">最新の内容を読み込む</button>}</div> : <JobFormError message={errors.root?.message} />}
    {mode === "edit" && <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"><span className="font-medium">案件：</span>{options.project.name}<span className="ml-2 text-slate-500">（変更不可）</span></div>}
    <Field name="name" label="業務名" required error={message("name")}><input {...register("name")} maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} className={controlClass} /></Field>
    <div className="grid gap-5 sm:grid-cols-2"><Field name="workplace_id" label="勤務先" required error={message("workplace_id")} helper={!canEditWorkplace ? "シフト作成後は勤務先を変更できません。" : undefined}>{canEditWorkplace ? <select {...register("workplace_id")} aria-invalid={Boolean(errors.workplace_id)} aria-describedby={errors.workplace_id ? "workplace_id-error" : undefined} className={controlClass}><option value="">選択してください</option>{options.workplaces.map((workplace) => <option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}</select> : <><input type="hidden" {...register("workplace_id")} /><select value={String(initialValues?.workplace_id ?? "")} disabled aria-label="勤務先（変更不可）" className={controlClass}>{options.workplaces.filter((workplace) => workplace.id === initialValues?.workplace_id).map((workplace) => <option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}</select></>}</Field><Field name="status" label="状態" required error={message("status")}><select {...register("status")} aria-invalid={Boolean(errors.status)} aria-describedby={errors.status ? "status-error" : undefined} className={controlClass}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{JOB_STATUS_LABELS[status]}</option>)}</select></Field></div>
    <Field name="description" label="仕事内容" error={message("description")}><textarea {...register("description")} rows={5} maxLength={2000} className={controlClass} /></Field>
    <div className="grid gap-5 sm:grid-cols-2"><Field name="hourly_wage" label="時給" error={message("hourly_wage")} helper={!canEditCompensation ? "配置済みスタッフがいるため、時給は変更できません。" : undefined}><div className="flex items-center gap-2">{canEditCompensation ? <input type="number" min="0" step="1" inputMode="numeric" {...register("hourly_wage")} aria-invalid={Boolean(errors.hourly_wage)} className={controlClass} /> : <><input type="hidden" {...register("hourly_wage")} /><input type="number" value={initialValues?.hourly_wage ?? ""} disabled aria-label="時給（変更不可）" className={controlClass} /></>}<span className="mt-1.5 text-sm text-slate-600">円</span></div></Field><Field name="transportation_fee_cap" label="交通費上限" error={message("transportation_fee_cap")} helper={!canEditCompensation ? "配置済みスタッフがいるため、交通費上限は変更できません。" : undefined}><div className="flex items-center gap-2">{canEditCompensation ? <input type="number" min="0" step="1" inputMode="numeric" {...register("transportation_fee_cap")} aria-invalid={Boolean(errors.transportation_fee_cap)} className={controlClass} /> : <><input type="hidden" {...register("transportation_fee_cap")} /><input type="number" value={initialValues?.transportation_fee_cap ?? ""} disabled aria-label="交通費上限（変更不可）" className={controlClass} /></>}<span className="mt-1.5 text-sm text-slate-600">円</span></div></Field></div>
    <Field name="dress_code" label="服装" error={message("dress_code")}><textarea {...register("dress_code")} rows={4} maxLength={2000} className={controlClass} /></Field>
    <Field name="requirements" label="応募条件" error={message("requirements")}><textarea {...register("requirements")} rows={4} maxLength={2000} className={controlClass} /></Field>
    <Field name="meal_notes" label="食事案内" error={message("meal_notes")}><textarea {...register("meal_notes")} rows={3} maxLength={2000} className={controlClass} /></Field>
    <Field name="recruitment_notes" label="募集補足" error={message("recruitment_notes")}><textarea {...register("recruitment_notes")} rows={3} maxLength={2000} className={controlClass} /></Field>
    <Field name="manual_url" label="業務資料URL" error={message("manual_url")}><input type="url" placeholder="https://..." {...register("manual_url")} aria-invalid={Boolean(errors.manual_url)} aria-describedby={errors.manual_url ? "manual_url-error" : undefined} className={controlClass} /></Field>
    {disabled && <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>この支店には利用可能な勤務先がありません。先に「取引先・勤務先」から勤務先を登録してください。</p><Link href="/admin/clients" className="mt-2 inline-flex min-h-10 items-center font-semibold text-blue-700 hover:underline">勤務先を管理する</Link></div>}
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><CancelAction cancelHref={cancelHref} onCancel={onCancel} /><button type="submit" disabled={disabled || isSubmitting} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-disabled">{isSubmitting ? pendingLabel : submitLabel}</button></div>
  </form>;
}

function CancelAction({ cancelHref, onCancel }: Pick<JobFormProps, "cancelHref" | "onCancel">) { const className = "inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-sm font-medium text-secondary-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"; if (onCancel) return <button type="button" onClick={onCancel} className={className}>キャンセル</button>; if (cancelHref) return <Link href={cancelHref} className={className}>キャンセル</Link>; return null; }

function Field({ name, label, required, error, helper, children }: { name: string; label: string; required?: boolean; error?: string; helper?: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-800">{label}{required && <span className="ml-1 text-red-700">*</span>}{children}{helper && <span className="mt-1.5 block text-sm font-normal text-slate-600">{helper}</span>}{error && <span id={`${name}-error`} className="mt-1.5 block text-sm text-red-700">{error}</span>}</label>; }
