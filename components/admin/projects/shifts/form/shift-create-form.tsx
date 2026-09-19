"use client";

import { unstable_rethrow } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminFeedback, AdminForbiddenState } from "@/components/admin/admin-state";
import { AdminEditorFooter, AdminEditorSection } from "@/components/admin/editor/admin-editor-layout";
import { SHIFT_EDITOR_SECTIONS } from "@/components/admin/editor/admin-editor-contract";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createShift } from "@/app/actions/shifts";
import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import { SHIFT_STATUSES, shiftFormSchema, type ShiftFormValues } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftCreateResult, ShiftFormOptions } from "@/lib/admin/projects/shift-form-types";
import type { ShiftUpdateResult } from "@/lib/admin/projects/update-shift-core";
import { ShiftFormError } from "./shift-form-error";

const control = "mt-1.5 min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-info focus:ring-2 focus:ring-info-subtle disabled:cursor-not-allowed disabled:bg-background-subtle disabled:text-foreground-muted";
type SubmitResult = ShiftCreateResult | ShiftUpdateResult;
type ShiftFormProps = {
  mode?: "create" | "edit";
  options: ShiftFormOptions;
  initialValues?: Partial<ShiftFormValues>;
  expectedUpdatedAt?: string;
  shiftId?: string;
  cancelHref?: string;
  onCancel?: () => void;
  submitLabel?: string;
  pendingLabel?: string;
  showContext?: boolean;
  submitAction?: (projectId: string, jobId: string, input: unknown) => Promise<SubmitResult>;
  onSuccess?: (id: string) => void;
  onConflict?: () => void;
  onPendingChange?: (pending: boolean) => void;
  restrictions?: { minimumRequiredWorkers: number; lockBreak: boolean; lockPlannedTime: boolean; plannedTimeReason?: string };
};

export function ShiftForm({ mode = "create", options, initialValues, expectedUpdatedAt, shiftId, cancelHref, onCancel, submitLabel = mode === "edit" ? "変更を保存" : "シフトを追加", pendingLabel = mode === "edit" ? "保存中..." : "シフトを追加中...", showContext = true, submitAction = createShift, onSuccess, onConflict, onPendingChange, restrictions }: ShiftFormProps) {
  const [failureKind, setFailureKind] = useState<string>();
  const defaultStatus = options.job.status === "draft" ? "draft" : "recruiting";
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting, isDirty } } = useForm<ShiftFormValues>({ resolver: zodResolver(shiftFormSchema), defaultValues: { start_date: "", start_time: "", end_date: "", end_time: "", required_workers: "1", break_minutes: "", deadline_date: "", deadline_time: "", status: defaultStatus, ...initialValues } });
  useEffect(() => { onPendingChange?.(isSubmitting); }, [isSubmitting, onPendingChange]);
  const submit = handleSubmit(async (values) => {
    try {
    const payload = mode === "edit" ? { ...values, id: shiftId, expectedUpdatedAt } : values;
    setFailureKind(undefined);
    const result = await submitAction(options.project.id, options.job.id, payload);
    if (result.ok) {
      if (mode === "create") reset();
      onSuccess?.("shiftId" in result ? result.shiftId : result.id);
      return;
    }
    if ("type" in result) setFailureKind(result.type);
    if ("type" in result && result.type === "conflict") { setError("root", { message: result.message }); return; }
    if ("fieldErrors" in result && result.fieldErrors) for (const [field, message] of Object.entries(result.fieldErrors)) if (typeof message === "string") setError(field as keyof ShiftFormValues, { message });
    if (result.message) setError("root", { message: result.message });
    } catch (cause) {
      unstable_rethrow(cause);
      setFailureKind("error");
      setError("root", { message: "通信を確認してください。保存結果を確認してから再度お試しください。" });
    }
  });
  const error = (field: keyof ShiftFormValues) => errors[field]?.message;
  const minRequired = restrictions?.minimumRequiredWorkers ?? 1;
  return <form onSubmit={submit} noValidate className="space-y-6">
    <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
    {failureKind === "conflict" ? <AdminFeedback kind="conflict" message={errors.root?.message ?? "最新の内容を読み込んでください。"}>{onConflict && <button type="button" onClick={onConflict} className="min-h-11 rounded-control border border-border-strong px-4 text-sm font-medium text-link">最新の内容を読み込む</button>}</AdminFeedback> : failureKind === "forbidden" ? <AdminForbiddenState message={errors.root?.message} /> : <ShiftFormError message={errors.root?.message} />}
    {isSubmitting ? <AdminFeedback kind="pending" message="保存しています。この画面を閉じないでください。" /> : isDirty && <AdminFeedback kind="unsaved" message="未保存の変更があります。" />}
    {showContext && <AdminEditorSection id="shift-context-title" title={SHIFT_EDITOR_SECTIONS[0]} description="対象の案件・勤務先・業務です。編集画面では変更できません。"><dl className="grid gap-4 sm:grid-cols-3">{[["案件", options.project.name], ["勤務先", options.job.workplaceName], ["業務", options.job.name]].map(([label, value]) => <div key={label}><dt className="text-xs text-foreground-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>{(options.job.hourlyWage !== null || options.job.transportationFeeCap !== null) && <p className="mt-4 text-sm text-foreground-secondary">時給 {options.job.hourlyWage ?? "未設定"}円 / 交通費上限 {options.job.transportationFeeCap ?? "未設定"}円</p>}</AdminEditorSection>}
    <AdminEditorSection id="shift-schedule-title" title={SHIFT_EDITOR_SECTIONS[1]} description={mode === "edit" ? "この画面では選択した1件だけを編集します。複数日への反映は行いません。" : "勤務日と開始・終了時刻を設定します。"}>
      {restrictions?.lockPlannedTime && <p className="mb-5 rounded-control bg-info-subtle p-3 text-sm text-foreground-secondary">{restrictions.plannedTimeReason ?? "関連する応募・配置・勤怠があるため予定時間を変更できません。"}</p>}
      <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field name="start_date" label="開始日" required error={error("start_date")}><input type="date" disabled={restrictions?.lockPlannedTime} {...register("start_date")} aria-invalid={Boolean(errors.start_date)} aria-describedby={errors.start_date ? "start_date-error" : undefined} className={control} /></Field><Field name="start_time" label="開始時刻" required error={error("start_time")}><input type="time" disabled={restrictions?.lockPlannedTime} {...register("start_time")} aria-invalid={Boolean(errors.start_time)} aria-describedby={errors.start_time ? "start_time-error" : undefined} className={control} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field name="end_date" label="終了日" required error={error("end_date")}><input type="date" disabled={restrictions?.lockPlannedTime} {...register("end_date")} aria-invalid={Boolean(errors.end_date)} aria-describedby={errors.end_date ? "end_date-error" : undefined} className={control} /></Field><Field name="end_time" label="終了時刻" required error={error("end_time")}><input type="time" disabled={restrictions?.lockPlannedTime} {...register("end_time")} aria-invalid={Boolean(errors.end_time)} aria-describedby={errors.end_time ? "end_time-error" : undefined} className={control} /></Field></div></div>
    </AdminEditorSection>
    <AdminEditorSection id="shift-conditions-title" title={SHIFT_EDITOR_SECTIONS[2]} description="必要人数、休憩、応募締切、公開状態を設定します。">
      <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field name="required_workers" label="必要人数" required error={error("required_workers")}><div className="flex items-center gap-2"><input type="number" min={minRequired} step="1" {...register("required_workers")} aria-invalid={Boolean(errors.required_workers)} aria-describedby={errors.required_workers ? "required_workers-error" : undefined} className={control} /><span className="mt-1.5 text-sm text-foreground-secondary">名</span></div>{mode === "edit" && minRequired > 0 && <span className="mt-1 block text-xs text-foreground-muted">配置済み人数により最小 {minRequired}名</span>}</Field><Field name="break_minutes" label="休憩時間" error={error("break_minutes")}><div className="flex items-center gap-2"><input type="number" min="0" step="1" disabled={restrictions?.lockBreak} {...register("break_minutes")} aria-invalid={Boolean(errors.break_minutes)} aria-describedby={errors.break_minutes ? "break_minutes-error" : undefined} className={control} /><span className="mt-1.5 text-sm text-foreground-secondary">分</span></div>{restrictions?.lockBreak && <span className="mt-1 block text-xs text-foreground-muted">配置済みスタッフがいるため変更できません。</span>}</Field></div>
      <fieldset><legend className="text-sm font-medium text-foreground-secondary">応募締切</legend><div className="grid gap-4 sm:grid-cols-2"><Field name="deadline_date" label="日付" error={error("deadline_date")}><input type="date" {...register("deadline_date")} aria-invalid={Boolean(errors.deadline_date)} aria-describedby={errors.deadline_date ? "deadline_date-error" : undefined} className={control} /></Field><Field name="deadline_time" label="時刻" error={error("deadline_time")}><input type="time" {...register("deadline_time")} aria-invalid={Boolean(errors.deadline_time)} aria-describedby={errors.deadline_time ? "deadline_time-error" : undefined} className={control} /></Field></div></fieldset>
      <Field name="status" label="状態" required error={error("status")}><select {...register("status")} aria-invalid={Boolean(errors.status)} aria-describedby={errors.status ? "status-error" : undefined} className={control}>{SHIFT_STATUSES.map((status) => <option key={status} value={status}>{SHIFT_STATUS_LABELS[status]}</option>)}</select></Field></div>
    </AdminEditorSection>
    </fieldset>
    {cancelHref ? <AdminEditorFooter cancelHref={cancelHref} pending={isSubmitting} submitLabel={submitLabel} pendingLabel={pendingLabel} note="保存後はシフト詳細へ戻ります。" /> : <div className="flex justify-end gap-3">{onCancel && <button type="button" onClick={onCancel} disabled={isSubmitting} className="min-h-11 rounded-control border border-border px-5 text-sm font-medium">キャンセル</button>}<button type="submit" disabled={isSubmitting} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground">{isSubmitting ? pendingLabel : submitLabel}</button></div>}
  </form>;
}

function Field({ name, label, required, error, children }: { name: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-foreground-secondary">{label}{required && <span className="ml-1 text-danger">*</span>}{children}{error && <span id={`${name}-error`} className="mt-1.5 block text-sm text-danger" role="alert">{error}</span>}</label>;
}
