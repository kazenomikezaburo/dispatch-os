"use client";

import { useActionState, useState } from "react";
import { confirmAttendanceRecord, type AttendanceActionResult } from "@/app/actions/attendance";
import { attendanceConfirmationSchema, type AttendanceConfirmationInput } from "@/lib/admin/attendance/attendance-confirmation-schema";

const initialState: AttendanceActionResult = { ok: true };
export function AttendanceConfirmationForm({ initial }: { initial: AttendanceConfirmationInput }) {
  const [values, setValues] = useState(initial);
  const [state, action, pending] = useActionState(async (_previous: AttendanceActionResult, form: FormData): Promise<AttendanceActionResult> => {
    const input = Object.fromEntries(form) as unknown as AttendanceConfirmationInput;
    const parsed = attendanceConfirmationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
    if (!window.confirm("この内容で勤怠を確定しますか？\n\n確定後はこの画面から変更できません。")) return { ok: true };
    return confirmAttendanceRecord(parsed.data);
  }, initialState);
  const start = Date.parse(`${values.actualStartDate}T${values.actualStartTime}+09:00`);
  const end = Date.parse(`${values.actualEndDate}T${values.actualEndTime}+09:00`);
  const work = Number.isFinite(start) && Number.isFinite(end) ? Math.max(Math.floor((end - start) / 60_000) - Number(values.breakMinutes || 0), 0) : 0;
  const field = (name: keyof AttendanceConfirmationInput) => ({ name, value: values[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [name]: event.target.value }) });
  return <form action={action} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
    <input type="hidden" {...field("assignmentId")} />
    <h2 className="text-lg font-semibold text-slate-950">確定勤務実績</h2>
    <div className="grid gap-4 sm:grid-cols-2"><fieldset><legend className="text-sm font-semibold text-slate-700">実勤務開始</legend><div className="mt-1 flex gap-2"><input aria-label="実勤務開始日" type="date" required {...field("actualStartDate")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3" /><input aria-label="実勤務開始時刻" type="time" step="1" required {...field("actualStartTime")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3" /></div></fieldset><fieldset><legend className="text-sm font-semibold text-slate-700">実勤務終了</legend><div className="mt-1 flex gap-2"><input aria-label="実勤務終了日" type="date" required {...field("actualEndDate")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3" /><input aria-label="実勤務終了時刻" type="time" step="1" required {...field("actualEndTime")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3" /></div></fieldset></div>
    <label className="block text-sm font-semibold text-slate-700">確定休憩（分）<input inputMode="numeric" required {...field("breakMinutes")} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3 sm:max-w-48" /></label>
    <p className="text-sm font-medium text-slate-700">実働：{Math.floor(work / 60)}時間{String(work % 60).padStart(2, "0")}分</p>
    <label className="block text-sm font-semibold text-slate-700">修正理由<textarea {...field("adjustmentReason")} maxLength={1000} rows={3} className="mt-1 w-full rounded border border-slate-300 p-3" /><span className="mt-1 block font-normal text-slate-500">打刻時刻・予定休憩から変更する場合、または打刻が不足する場合は必須です。</span></label>
    {!state.ok && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
    <button disabled={pending} className="min-h-11 rounded bg-blue-700 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{pending ? "勤怠を確定中..." : "勤怠を確定"}</button>
  </form>;
}
