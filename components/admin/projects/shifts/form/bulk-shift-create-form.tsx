"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { createBulkShifts } from "@/app/actions/shifts";
import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import {
  bulkShiftFormSchema,
  type BulkShiftFormValues,
} from "@/lib/admin/projects/bulk-shift-form-schema";
import { SHIFT_STATUSES } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftFormOptions } from "@/lib/admin/projects/shift-form-types";
import { BulkShiftPreview } from "./bulk-shift-preview";
import { ShiftFormError } from "./shift-form-error";

const control = "mt-1.5 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const displayDate = (date: string) => date.replace(/-/g, "/");

export function BulkShiftCreateForm({ options }: { options: ShiftFormOptions }) {
  const defaultStatus = options.job.status === "draft" ? "draft" : "recruiting";
  const [dateInput, setDateInput] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control: formControl,
    formState: { errors, isSubmitting },
  } = useForm<BulkShiftFormValues>({
    resolver: zodResolver(bulkShiftFormSchema),
    defaultValues: {
      dates: [],
      startTime: "",
      endTime: "",
      endsNextDay: false,
      requiredWorkers: "1",
      breakMinutes: "",
      deadlineEnabled: false,
      deadlineDaysBefore: "2",
      deadlineTime: "18:00",
      status: defaultStatus,
    },
  });
  const values = useWatch({ control: formControl });
  const dates = values.dates ?? [];
  const updateDates = (next: string[]) => {
    setValue("dates", [...next].sort(), { shouldValidate: true, shouldDirty: true });
  };
  const addDate = () => {
    if (!dateInput) return;
    if (dates.includes(dateInput)) {
      setError("dates", { message: "同じ勤務日が重複しています。" });
      return;
    }
    if (dates.length >= 31) {
      setError("dates", { message: "勤務日は31日以内で選択してください。" });
      return;
    }
    updateDates([...dates, dateInput]);
    setDateInput("");
  };
  const submit = handleSubmit(async (input) => {
    const result = await createBulkShifts(options.project.id, options.job.id, input);
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof BulkShiftFormValues, { message });
      }
    }
    if (result.message) setError("root", { message: result.message });
  });
  const error = (field: keyof BulkShiftFormValues) => errors[field]?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <ShiftFormError message={errors.root?.message} />
      <section aria-labelledby="context-title" className="rounded-md bg-slate-50 p-4">
        <h2 id="context-title" className="text-sm font-semibold text-slate-700">対象案件・業務</h2>
        <p className="mt-2 font-semibold text-slate-950">{options.project.name}</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{options.job.name}</p>
        <p className="mt-1 text-sm text-slate-600">{options.job.workplaceName}</p>
        {(options.job.hourlyWage !== null || options.job.transportationFeeCap !== null) && (
          <p className="mt-2 text-sm text-slate-600">時給 {options.job.hourlyWage ?? "未設定"}円 / 交通費上限 {options.job.transportationFeeCap ?? "未設定"}円</p>
        )}
      </section>

      <fieldset aria-describedby={errors.dates ? "dates-error" : undefined}>
        <legend className="text-sm font-medium text-slate-800">勤務日 <span className="text-red-700">*</span></legend>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input type="date" value={dateInput} onChange={(event) => setDateInput(event.target.value)} aria-label="追加する勤務日" aria-invalid={Boolean(errors.dates)} className={control} />
          <button type="button" onClick={addDate} disabled={!dateInput || dates.length >= 31} className="min-h-11 shrink-0 rounded-md border border-blue-700 px-5 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">追加</button>
        </div>
        {errors.dates?.message && <p id="dates-error" className="mt-1.5 text-sm text-red-700">{errors.dates.message}</p>}
        <p className="mt-2 text-xs text-slate-500">1〜31日を選択できます。選択済み：{dates.length}日</p>
        {dates.length > 0 && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {dates.map((date) => <li key={date} className="flex min-h-11 items-center justify-between rounded-md border border-slate-200 px-3 text-sm"><span>{displayDate(date)}</span><button type="button" onClick={() => updateDates(dates.filter((item) => item !== date))} aria-label={`${displayDate(date)}を削除`} className="min-h-9 rounded px-3 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">削除</button></li>)}
          </ul>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="startTime" label="開始時刻" required error={error("startTime")}><input type="time" {...register("startTime")} aria-invalid={Boolean(errors.startTime)} aria-describedby={errors.startTime ? "startTime-error" : undefined} className={control} /></Field>
        <Field name="endTime" label="終了時刻" required error={error("endTime")}><input type="time" {...register("endTime")} aria-invalid={Boolean(errors.endTime)} aria-describedby={errors.endTime ? "endTime-error" : undefined} className={control} /></Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-800"><input type="checkbox" {...register("endsNextDay")} className="size-5 rounded border-slate-300" />終了は翌日</label>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="requiredWorkers" label="必要人数" required error={error("requiredWorkers")}><div className="flex items-center gap-2"><input type="number" min="1" step="1" {...register("requiredWorkers")} aria-invalid={Boolean(errors.requiredWorkers)} className={control} /><span className="mt-1.5 text-sm text-slate-600">名</span></div></Field>
        <Field name="breakMinutes" label="休憩時間" error={error("breakMinutes")}><div className="flex items-center gap-2"><input type="number" min="0" step="1" {...register("breakMinutes")} aria-invalid={Boolean(errors.breakMinutes)} className={control} /><span className="mt-1.5 text-sm text-slate-600">分</span></div></Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-800">応募締切</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-800"><input type="checkbox" {...register("deadlineEnabled")} className="size-5 rounded border-slate-300" />応募締切を設定する</label>
        {values.deadlineEnabled && <div className="grid gap-5 sm:grid-cols-2"><Field name="deadlineDaysBefore" label="勤務日の何日前" required error={error("deadlineDaysBefore")}><div className="flex items-center gap-2"><input type="number" min="0" step="1" {...register("deadlineDaysBefore")} aria-invalid={Boolean(errors.deadlineDaysBefore)} className={control} /><span className="mt-1.5 text-sm text-slate-600">日前</span></div></Field><Field name="deadlineTime" label="時刻" required error={error("deadlineTime")}><input type="time" {...register("deadlineTime")} aria-invalid={Boolean(errors.deadlineTime)} className={control} /></Field></div>}
      </fieldset>

      <Field name="status" label="状態" required error={error("status")}><select {...register("status")} aria-invalid={Boolean(errors.status)} className={control}>{SHIFT_STATUSES.map((status) => <option key={status} value={status}>{SHIFT_STATUS_LABELS[status]}</option>)}</select></Field>

      <BulkShiftPreview dates={dates} startTime={values.startTime ?? ""} endTime={values.endTime ?? ""} endsNextDay={values.endsNextDay ?? false} requiredWorkers={values.requiredWorkers ?? ""} breakMinutes={values.breakMinutes ?? ""} deadlineEnabled={values.deadlineEnabled ?? false} deadlineDaysBefore={values.deadlineDaysBefore ?? ""} deadlineTime={values.deadlineTime ?? ""} />

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><Link href={`/admin/projects/${options.project.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">キャンセル</Link><button type="submit" disabled={isSubmitting || dates.length === 0} className="min-h-11 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400">{isSubmitting ? "シフトを追加中..." : `${dates.length}件のシフトを追加`}</button></div>
    </form>
  );
}

function Field({ name, label, required, error, children }: { name: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-800">{label}{required && <span className="ml-1 text-red-700">*</span>}{children}{error && <span id={`${name}-error`} className="mt-1.5 block text-sm text-red-700">{error}</span>}</label>;
}
