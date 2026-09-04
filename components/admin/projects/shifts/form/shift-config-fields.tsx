"use client";

import type { BulkShiftConfig } from "@/lib/admin/projects/bulk-shift-helpers";
import { SHIFT_STATUSES } from "@/lib/admin/projects/shift-form-schema";
import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";

export const shiftControlClass = "min-h-11 w-full min-w-0 rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus-ring focus:ring-2 focus:ring-info-subtle disabled:bg-surface-muted disabled:text-foreground-disabled";

export function ShiftConfigFields({ value, onChange, disabled = false }: { value: BulkShiftConfig; onChange: (value: BulkShiftConfig) => void; disabled?: boolean }) {
  const update = <K extends keyof BulkShiftConfig>(key: K, next: BulkShiftConfig[K]) => onChange({ ...value, [key]: next });
  return <fieldset disabled={disabled} className="min-w-0 space-y-4">
    <legend className="sr-only">勤務条件</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="開始時刻"><input type="time" required value={value.startTime} onChange={(e) => update("startTime", e.target.value)} className={shiftControlClass} /></Field>
      <Field label="終了時刻"><input type="time" required value={value.endTime} onChange={(e) => update("endTime", e.target.value)} className={shiftControlClass} /></Field>
      <Field label="必要人数"><input type="number" min="1" step="1" required value={value.requiredWorkers} onChange={(e) => update("requiredWorkers", e.target.value)} className={shiftControlClass} /></Field>
      <Field label="休憩（分）"><input type="number" min="0" step="1" value={value.breakMinutes} onChange={(e) => update("breakMinutes", e.target.value)} className={shiftControlClass} /></Field>
    </div>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value.endsNextDay} onChange={(e) => update("endsNextDay", e.target.checked)} className="size-5" />終了は翌日</label>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value.deadlineEnabled} onChange={(e) => update("deadlineEnabled", e.target.checked)} className="size-5" />応募締切を設定</label>
    {value.deadlineEnabled && <div className="grid gap-4 sm:grid-cols-2">
      <Field label="勤務日の何日前"><input type="number" min="0" step="1" value={value.deadlineDaysBefore} onChange={(e) => update("deadlineDaysBefore", e.target.value)} className={shiftControlClass} /></Field>
      <Field label="締切時刻"><input type="time" value={value.deadlineTime} onChange={(e) => update("deadlineTime", e.target.value)} className={shiftControlClass} /></Field>
    </div>}
    <Field label="状態"><select value={value.status} onChange={(e) => update("status", e.target.value as BulkShiftConfig["status"])} className={shiftControlClass}>{SHIFT_STATUSES.map((status) => <option key={status} value={status}>{SHIFT_STATUS_LABELS[status]}</option>)}</select></Field>
  </fieldset>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground-secondary">{label}{children}</label>; }
