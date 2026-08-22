"use client";

import { useActionState, useState } from "react";
import { reviseAttendanceRecord, type AttendanceActionResult } from "@/app/actions/attendance";
import { attendanceRevisionSchema, type AttendanceRevisionInput } from "@/lib/admin/attendance/attendance-revision-schema";

const initialState: AttendanceActionResult = { ok: true };
function localParts(value: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date(value)); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""; return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}:${get("second")}` }; }

export function AttendanceRevisionForm({ assignmentId, actualStartAt, actualEndAt, breakMinutes }: { assignmentId: string; actualStartAt: string; actualEndAt: string; breakMinutes: number }) {
  const start = localParts(actualStartAt); const end = localParts(actualEndAt);
  const initial: AttendanceRevisionInput = { assignmentId, actualStartDate: start.date, actualStartTime: start.time, actualEndDate: end.date, actualEndTime: end.time, breakMinutes: String(breakMinutes), reason: "" };
  const [editing, setEditing] = useState(false); const [values, setValues] = useState(initial);
  const [state, action, pending] = useActionState(async (_previous: AttendanceActionResult, form: FormData) => {
    const parsed = attendanceRevisionSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
    if (!window.confirm("この内容で勤怠を訂正しますか？\n訂正内容と理由は監査履歴に保存されます。")) return { ok: true as const };
    const result = await reviseAttendanceRecord(parsed.data); if (result.ok) setEditing(false); return result;
  }, initialState);
  const field = (name: keyof AttendanceRevisionInput) => ({ name, value: values[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [name]: event.target.value }) });
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="mt-5 min-h-11 rounded border border-blue-700 px-5 font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2">勤怠を訂正</button>;
  const changes = [values.actualStartDate !== initial.actualStartDate || values.actualStartTime !== initial.actualStartTime ? "勤務開始" : "", values.actualEndDate !== initial.actualEndDate || values.actualEndTime !== initial.actualEndTime ? "勤務終了" : "", values.breakMinutes !== initial.breakMinutes ? "休憩" : ""].filter(Boolean);
  return <form action={action} className="mt-5 space-y-4 border-t border-slate-200 pt-5">
    <input type="hidden" name="assignmentId" value={assignmentId} /><h3 className="font-semibold">勤怠訂正</h3>
    <div className="grid gap-4 sm:grid-cols-2"><fieldset><legend className="text-sm font-semibold">実勤務開始</legend><div className="mt-1 flex gap-2"><input aria-label="訂正後開始日" type="date" required {...field("actualStartDate")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3"/><input aria-label="訂正後開始時刻" type="time" step="1" required {...field("actualStartTime")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3"/></div></fieldset><fieldset><legend className="text-sm font-semibold">実勤務終了</legend><div className="mt-1 flex gap-2"><input aria-label="訂正後終了日" type="date" required {...field("actualEndDate")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3"/><input aria-label="訂正後終了時刻" type="time" step="1" required {...field("actualEndTime")} className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3"/></div></fieldset></div>
    <label className="block text-sm font-semibold">休憩（分）<input inputMode="numeric" required {...field("breakMinutes")} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3 sm:max-w-48"/></label>
    <label className="block text-sm font-semibold">訂正理由（必須）<textarea required maxLength={500} rows={3} {...field("reason")} aria-invalid={!state.ok || undefined} className="mt-1 w-full rounded border border-slate-300 p-3"/></label>
    <p className="rounded bg-slate-50 p-3 text-sm">変更項目：{changes.length ? changes.join("、") : "変更なし"}</p>{!state.ok && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
    <div className="flex gap-3"><button disabled={pending} className="min-h-11 rounded bg-blue-700 px-5 font-semibold text-white disabled:bg-slate-400">{pending ? "訂正中..." : "訂正を保存"}</button><button type="button" disabled={pending} onClick={() => { setValues(initial); setEditing(false); }} className="min-h-11 rounded border border-slate-300 px-5 font-semibold">キャンセル</button></div>
  </form>;
}
