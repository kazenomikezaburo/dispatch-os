"use client";

import { useState, useTransition } from "react";
import { submitPreShiftConfirmation } from "@/app/actions/pre-shift-confirmations";
import { HEALTH_STATUSES, preShiftConfirmationSchema, type HealthStatus } from "@/lib/worker/pre-shift-confirmation-schema";

const healthLabels: Record<HealthStatus, string> = { good: "問題ありません", concern: "少し不安があります", unwell: "体調が悪いです" };

export function PreShiftConfirmationForm({ assignmentId }: { assignmentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  function submit(formData: FormData) {
    const canWorkValue = formData.get("canWork");
    const canWork = canWorkValue === "true" ? true : canWorkValue === "false" ? false : undefined;
    const value = preShiftConfirmationSchema.safeParse({ assignmentId, canWork, healthStatus: formData.get("healthStatus"), plannedWakeAt: formData.get("plannedWakeAt"), plannedDepartureAt: formData.get("plannedDepartureAt") });
    if (!value.success) {
      const errors = Object.fromEntries(value.error.issues.map((issue) => [String(issue.path[0]), "選択してください。"])) as Record<string, string>;
      setFieldErrors(errors); return;
    }
    setFieldErrors({}); setError(null);
    startTransition(async () => { const result = await submitPreShiftConfirmation(value.data); if (!result.ok) setError(result.message); });
  }
  return <form action={submit} className="space-y-6">
    <fieldset aria-invalid={Boolean(fieldErrors.canWork)} aria-describedby={fieldErrors.canWork ? "can-work-error" : undefined}><legend className="font-semibold text-slate-950">勤務できますか？ <span className="text-red-700">*</span></legend><div className="mt-3 grid gap-2">{[["true", "勤務できます"], ["false", "勤務できません"]].map(([value, label]) => <label key={value} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-300 px-4 focus-within:ring-2 focus-within:ring-blue-600"><input type="radio" name="canWork" value={value} disabled={isPending} />{label}</label>)}</div>{fieldErrors.canWork && <p id="can-work-error" className="mt-2 text-sm text-red-700">{fieldErrors.canWork}</p>}</fieldset>
    <fieldset aria-invalid={Boolean(fieldErrors.healthStatus)} aria-describedby={fieldErrors.healthStatus ? "health-error" : undefined}><legend className="font-semibold text-slate-950">体調はいかがですか？ <span className="text-red-700">*</span></legend><div className="mt-3 grid gap-2">{HEALTH_STATUSES.map((value) => <label key={value} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-300 px-4 focus-within:ring-2 focus-within:ring-blue-600"><input type="radio" name="healthStatus" value={value} disabled={isPending} />{healthLabels[value]}</label>)}</div>{fieldErrors.healthStatus && <p id="health-error" className="mt-2 text-sm text-red-700">{fieldErrors.healthStatus}</p>}</fieldset>
    <fieldset><legend className="font-semibold text-slate-950">起床・出発予定（任意）</legend><p className="mt-1 text-sm text-slate-600">予定を入力すると当日の案内に表示されます。実際の起床・出発報告にはなりません。</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-800">起床予定（日本時間）<input type="datetime-local" name="plannedWakeAt" disabled={isPending} aria-invalid={Boolean(fieldErrors.plannedWakeAt)} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" /></label><label className="text-sm font-medium text-slate-800">出発予定（日本時間）<input type="datetime-local" name="plannedDepartureAt" disabled={isPending} aria-invalid={Boolean(fieldErrors.plannedDepartureAt)} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" /></label></div>{fieldErrors.plannedDepartureAt && <p className="mt-2 text-sm text-red-700">{fieldErrors.plannedDepartureAt}</p>}</fieldset>
    <button type="submit" disabled={isPending} className="min-h-12 w-full rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-slate-400">{isPending ? "送信中..." : "確認内容を送信"}</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
