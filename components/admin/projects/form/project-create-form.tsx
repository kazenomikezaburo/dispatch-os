"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createProject, updateProject } from "@/app/actions/projects";
import { PROJECT_STATUS_LABELS } from "@/lib/admin/projects/project-rules";
import { PROJECT_STATUSES } from "@/lib/admin/projects/project-types";
import { projectFormSchema, type ProjectFormInput } from "@/lib/admin/projects/project-form-schema";
import type { ProjectFormOptions } from "@/lib/admin/projects/project-form-types";
import type { ProjectUpdateInput } from "@/lib/admin/projects/project-update-schema";
import { ProjectFormError } from "./project-form-error";

const fieldClass = "mt-1.5 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus-ring focus:ring-2 focus:ring-info-subtle disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-foreground-disabled";

type ProjectFormProps = {
  options: ProjectFormOptions;
  mode?: "create" | "edit";
  initialValues?: Partial<ProjectFormInput>;
  projectId?: string;
  expectedUpdatedAt?: string;
  cancelHref?: string;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
  onSuccess?: () => void;
  onReloadLatest?: () => void;
  submitLabel?: string;
  pendingLabel?: string;
};

export function ProjectForm({ options, mode = "create", initialValues, projectId, expectedUpdatedAt, cancelHref, onCancel, onPendingChange, onSuccess, onReloadLatest, submitLabel = mode === "edit" ? "変更を保存" : "案件を作成", pendingLabel = mode === "edit" ? "保存中..." : "案件を作成中..." }: ProjectFormProps) {
  const defaultBranch = initialValues?.branch_id ?? options.branches[0]?.id ?? "";
  const { register, handleSubmit, control, setError, setValue, formState: { errors, isSubmitting } } = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: "", branch_id: defaultBranch, client_id: options.clients.find((client) => client.branchId === defaultBranch)?.id ?? "", start_date: "", end_date: "", status: "draft", description: "", ...initialValues },
  });
  const branchId = useWatch({ control, name: "branch_id" });
  const clients = options.clients.filter((client) => client.branchId === branchId);
  const clientId = useWatch({ control, name: "client_id" });
  useEffect(() => {
    if (!clients.some((client) => client.id === clientId)) setValue("client_id", clients[0]?.id ?? "", { shouldValidate: true });
  }, [clientId, clients, setValue]);
  const disabled = options.branches.length === 0 || options.clients.length === 0;

  const submit = handleSubmit(async (values) => {
    onPendingChange?.(true);
    try {
      if (mode === "create") {
        const result = await createProject(values);
        if (result.fieldErrors) for (const [field, message] of Object.entries(result.fieldErrors)) if (message) setError(field as keyof ProjectFormInput, { message });
        if (result.message) setError("root", { message: result.message });
        return;
      }
      if (!projectId || !expectedUpdatedAt) {
        setError("root", { message: "編集情報を確認できませんでした。最新の内容を読み込んでください。" });
        return;
      }
      const editableValues = { name: values.name, client_id: values.client_id, start_date: values.start_date, end_date: values.end_date, status: values.status, description: values.description };
      const payload: ProjectUpdateInput = { id: projectId, expectedUpdatedAt, ...editableValues };
      const result = await updateProject(payload);
      if (result.ok) {
        onSuccess?.();
        return;
      }
      if (result.type === "validation" && result.fieldErrors) for (const [field, message] of Object.entries(result.fieldErrors)) if (message) setError(field as keyof ProjectFormInput, { message });
      setError("root", { message: result.message });
    } finally {
      onPendingChange?.(false);
    }
  });
  const error = (name: keyof ProjectFormInput) => errors[name]?.message;

  return <form onSubmit={submit} noValidate className="space-y-5 rounded-panel border border-border bg-surface p-4 sm:p-6">
    {errors.root?.message && mode === "edit" && errors.root.message.includes("更新されています") ? <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">他の管理者によって案件が更新されています。最新の内容を読み込んでください。</p>{onReloadLatest && <button type="button" onClick={onReloadLatest} className="mt-3 inline-flex min-h-11 items-center font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">最新の内容を読み込む</button>}</div> : <ProjectFormError message={errors.root?.message} />}
    <Field label="案件名" required error={error("name")}><input {...register("name")} maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "案件名-error" : undefined} className={fieldClass} /></Field>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="支店" required error={error("branch_id")}>{mode === "edit" ? <select value={defaultBranch} disabled aria-label="支店（変更不可）" className={fieldClass}>{options.branches.filter((branch) => branch.id === defaultBranch).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select> : <select {...register("branch_id")} aria-invalid={Boolean(errors.branch_id)} aria-describedby={errors.branch_id ? "支店-error" : undefined} className={fieldClass}>{options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}</Field>
      <Field label="取引先" required error={error("client_id")}><select {...register("client_id")} aria-invalid={Boolean(errors.client_id)} aria-describedby={errors.client_id ? "取引先-error" : undefined} className={fieldClass}><option value="">選択してください</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
    </div>
    {options.clients.length === 0 && <p className="text-sm text-amber-800">利用可能な取引先がありません。先に取引先を登録してください。</p>}
    <div className="grid gap-5 sm:grid-cols-2"><Field label="開始日" required error={error("start_date")}><input type="date" {...register("start_date")} aria-invalid={Boolean(errors.start_date)} aria-describedby={errors.start_date ? "開始日-error" : undefined} className={fieldClass} /></Field><Field label="終了日" required error={error("end_date")}><input type="date" {...register("end_date")} aria-invalid={Boolean(errors.end_date)} aria-describedby={errors.end_date ? "終了日-error" : undefined} className={fieldClass} /></Field></div>
    <Field label="状態" required error={error("status")}><select {...register("status")} aria-invalid={Boolean(errors.status)} aria-describedby={errors.status ? "状態-error" : undefined} className={fieldClass}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}</select></Field>
    <Field label="説明" error={error("description")}><textarea {...register("description")} maxLength={2000} rows={5} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "説明-error" : undefined} className={fieldClass} /></Field>
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><CancelAction cancelHref={cancelHref} onCancel={onCancel} /><button type="submit" disabled={disabled || isSubmitting} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-disabled">{isSubmitting ? pendingLabel : submitLabel}</button></div>
  </form>;
}

function CancelAction({ cancelHref, onCancel }: Pick<ProjectFormProps, "cancelHref" | "onCancel">) {
  const className = "inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-sm font-medium text-secondary-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
  if (onCancel) return <button type="button" onClick={onCancel} className={className}>キャンセル</button>;
  if (cancelHref) return <Link href={cancelHref} className={className}>キャンセル</Link>;
  return null;
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  const id = `${label}-error`;
  return <label className="block text-sm font-medium text-slate-800">{label}{required && <span className="ml-1 text-red-700">*</span>}{children}{error && <span id={id} className="mt-1.5 block text-sm text-red-700">{error}</span>}</label>;
}
