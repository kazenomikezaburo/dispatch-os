"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { createBulkShifts } from "@/app/actions/shifts";
import { Drawer } from "@/components/admin/drawer";
import { AdminEmptyState, AdminFeedback, adminStateActionClass } from "@/components/admin/admin-state";
import { bulkResolvedShiftSchema, bulkShiftFormSchema } from "@/lib/admin/projects/bulk-shift-form-schema";
import { generateDates, normalizeOverride, resolveShiftConfig, type BulkShiftConfig, type BulkShiftOverrides } from "@/lib/admin/projects/bulk-shift-helpers";
import { addShiftDates, initialShiftDates } from "@/lib/admin/projects/shift-create-editor-state";
import type { ShiftFormOptions } from "@/lib/admin/projects/shift-form-types";
import { ShiftConfigFields, shiftControlClass } from "./shift-config-fields";

const dateLabel = (date: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${date}T00:00:00Z`));
const primary = "inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-disabled";

export function ShiftCreateEditor({ options, initialDate }: { options: ShiftFormOptions; initialDate: string }) {
  const [base, setBase] = useState<BulkShiftConfig>({ startTime: "09:00", endTime: "18:00", endsNextDay: false, requiredWorkers: "1", breakMinutes: "", deadlineEnabled: false, deadlineDaysBefore: "2", deadlineTime: "18:00", status: options.job.status === "draft" ? "draft" : "recruiting" });
  const [dates, setDates] = useState(() => initialShiftDates(initialDate));
  const [manualDate, setManualDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [overrides, setOverrides] = useState<BulkShiftOverrides>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draft, setDraft] = useState(base);
  const [draftError, setDraftError] = useState<string>();
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const resolved = useMemo(() => dates.map((date) => ({ date, ...resolveShiftConfig(base, overrides[date]) })), [dates, base, overrides]);
  const errors = useMemo(() => Object.fromEntries(resolved.flatMap((row) => {
    const result = bulkResolvedShiftSchema.safeParse(row);
    return result.success ? [] : [[row.date, result.error.issues.map((issue) => issue.message).join(" ")]];
  })), [resolved]);
  const changed = () => { setPreview(false); setError(undefined); };

  function addDate() {
    if (!manualDate) { setError("追加する日付を入力してください。"); return; }
    if (dates.includes(manualDate)) { setError("同じ勤務日は追加できません。"); return; }
    const next = addShiftDates(dates, [manualDate]);
    if (next.length === dates.length) { setError("有効な日付を指定してください。"); return; }
    setDates(next); setManualDate(""); changed();
  }
  function generate() {
    const generated = generateDates(rangeStart, rangeEnd, weekdays);
    if (generated.length === 0) { setError("期間と曜日を確認してください。"); return; }
    setDates((current) => addShiftDates(current, generated)); changed();
  }
  function resetOverride(date: string) {
    setOverrides((current) => { const next = { ...current }; delete next[date]; return next; }); changed();
  }
  function openOverride(date: string) {
    setDraft(resolveShiftConfig(base, overrides[date])); setDraftError(undefined); setSelectedDate(date);
  }
  function saveOverride() {
    if (!selectedDate) return;
    const result = bulkResolvedShiftSchema.safeParse({ date: selectedDate, ...draft });
    if (!result.success) { setDraftError(result.error.issues.map((issue) => issue.message).join(" ")); return; }
    const difference = normalizeOverride(base, draft);
    setOverrides((current) => { const next = { ...current }; if (Object.keys(difference).length) next[selectedDate] = difference; else delete next[selectedDate]; return next; });
    setSelectedDate(null); changed();
  }
  function review() {
    const result = bulkShiftFormSchema.safeParse({ shifts: resolved });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "入力内容を確認してください。"); errorRef.current?.focus(); return; }
    setError(undefined); setPreview(true);
    requestAnimationFrame(() => previewRef.current?.focus());
  }
  async function submit() {
    if (submitting.current || !preview || !bulkShiftFormSchema.safeParse({ shifts: resolved }).success) return;
    submitting.current = true; setPending(true); setError(undefined);
    try {
      // Existing bulk path validates >= 1 day and inserts independent rows atomically.
      // Reuse it for one or many dates; no new action contract or domain logic.
      const result = await createBulkShifts(options.project.id, options.job.id, { shifts: resolved });
      setError(result.message ?? (Object.values(result.fieldErrors ?? {}).filter(Boolean).join(" ") || "作成できませんでした。入力内容を確認してください。"));
      errorRef.current?.focus();
    } catch (cause) {
      unstable_rethrow(cause); // keep the existing success redirect
      setError("通信を確認してください。作成結果を案件画面で確認してから再度お試しください。");
    } finally { submitting.current = false; setPending(false); }
  }

  return <div className="space-y-6">
    <div ref={errorRef} tabIndex={-1}>{error && <AdminFeedback kind="error" message={error} />}</div>
    <fieldset disabled={pending} className="min-w-0 space-y-6">
      <legend className="sr-only">シフト作成</legend>
      <section className="rounded-panel border border-border bg-surface p-4 sm:p-6" aria-labelledby="create-context-title">
        <h2 id="create-context-title" className="text-lg font-semibold">基本情報</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">{[["案件", options.project.name], ["勤務先", options.job.workplaceName], ["業務", options.job.name]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-foreground-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>
        <p className="mt-4 text-xs text-foreground-muted">案件・業務の文脈は固定です。別の業務に作成する場合は案件画面で選び直してください。</p>
      </section>
      <section className="rounded-panel border border-border bg-surface p-4 sm:p-6" aria-labelledby="create-dates-title">
        <h2 id="create-dates-title" className="text-lg font-semibold">日程</h2><p className="mt-1 text-sm text-foreground-secondary">最初は1日分。必要な日付を追加し、例外の日だけ個別設定を変更できます。</p>
        <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-end"><label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium">追加する日付<input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className={shiftControlClass} /></label><button type="button" onClick={addDate} className={adminStateActionClass}>＋ 日付を追加</button></div>
        <details className="mt-4 rounded-control border border-border p-3"><summary className="cursor-pointer py-2 text-sm font-medium">期間・曜日から追加</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm">期間の開始日<input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className={shiftControlClass} /></label><label className="grid gap-1.5 text-sm">期間の終了日<input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className={shiftControlClass} /></label></div>
          <fieldset className="mt-4"><legend className="text-sm">曜日</legend><div className="mt-2 flex flex-wrap gap-2">{["日", "月", "火", "水", "木", "金", "土"].map((label, index) => <label key={label} className="flex min-h-11 items-center gap-2 rounded-control border border-border px-3 text-sm"><input type="checkbox" checked={weekdays.includes(index)} onChange={() => setWeekdays((current) => current.includes(index) ? current.filter((d) => d !== index) : [...current, index])} />{label}</label>)}</div></fieldset>
          <button type="button" onClick={generate} className={`${adminStateActionClass} mt-4`}>対象日を追加</button><p className="mt-2 text-xs text-foreground-muted">既存の日付と個別設定を保持し、重複を除いて追加します。</p>
        </details>
        <p role="status" className="mt-4 text-sm text-foreground-secondary">作成対象 {dates.length}日</p>
        {dates.length === 0 ? <div className="mt-3"><AdminEmptyState title="勤務日を追加してください" description="日付は追加・除外で管理します。" /></div> : <ul className="mt-3 divide-y divide-border rounded-control border border-border">{resolved.map((row) => <li key={row.date} className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><button type="button" onClick={() => openOverride(row.date)} className="inline-flex min-h-11 items-center text-left text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring">{dateLabel(row.date)}の設定</button><p className="text-sm text-foreground-secondary">{row.startTime}〜{row.endTime}{row.endsNextDay && "（翌日）"} / 必要{row.requiredWorkers}名</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-pill px-3 py-1 text-xs ${overrides[row.date] ? "bg-info-subtle text-link" : "bg-surface-muted text-foreground-secondary"}`}>{overrides[row.date] ? "個別設定あり" : "共通設定"}</span><button type="button" aria-label={`${dateLabel(row.date)}を除外`} onClick={() => { setDates((current) => current.filter((d) => d !== row.date)); resetOverride(row.date); }} className={adminStateActionClass}>除外</button></div></div>
          {errors[row.date] && <p role="alert" className="mt-2 text-sm text-danger">{errors[row.date]}</p>}
        </li>)}</ul>}
      </section>
      <section aria-labelledby="create-common-title" className="rounded-panel border border-border bg-surface p-4 sm:p-6"><h2 id="create-common-title" className="text-lg font-semibold">共通設定</h2><p className="mb-4 mt-1 text-sm text-foreground-secondary">個別に変更していない項目へ反映されます。個別設定済みの項目は保持します。</p><ShiftConfigFields value={base} onChange={(value) => { setBase(value); changed(); }} /></section>
      <section ref={previewRef} tabIndex={-1} aria-labelledby="create-preview-title" className="rounded-panel border border-border bg-surface p-4 sm:p-6 focus:outline-none">
        <h2 id="create-preview-title" className="text-lg font-semibold">作成内容の確認</h2><p className="mt-2 text-sm">{dates.length}件の独立したシフト / 個別設定 {Object.keys(overrides).length}日 / エラー {Object.keys(errors).length}日</p>
        {preview ? <><ul className="mt-4 divide-y divide-border">{resolved.map((row) => <li key={row.date} className="flex flex-wrap gap-x-4 gap-y-2 py-3 text-sm"><span className="font-medium">{dateLabel(row.date)}</span><span>{row.startTime}〜{row.endTime}{row.endsNextDay && "（翌日）"}</span><span>必要{row.requiredWorkers}名 / 休憩{row.breakMinutes || "未設定"}{row.breakMinutes && "分"}</span><span>{overrides[row.date] ? "個別設定あり" : "共通設定"}</span></li>)}</ul><AdminFeedback kind="success" message="入力内容を確認しました。作成後は1件ずつ個別に編集できます。" /></> : <p className="mt-2 text-sm text-foreground-muted">プレビューを確認してから作成してください。設定変更後は再確認が必要です。</p>}
        <button type="button" onClick={review} className={`${adminStateActionClass} mt-4`}>プレビューを確認</button>
      </section>
    </fieldset>
    {pending && <AdminFeedback kind="pending" message="シフトを作成しています。この画面を閉じないでください。" />}
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-foreground-muted">作成後の一括編集は行いません。</p><div className="flex flex-wrap gap-3">{pending ? <button disabled className={adminStateActionClass}>キャンセル</button> : <Link href={`/admin/projects/${options.project.id}`} className={adminStateActionClass}>キャンセル</Link>}<button type="button" onClick={submit} disabled={pending || !preview} className={primary}>{pending ? "作成中…" : `${dates.length}件のシフトを作成`}</button></div>
    </div>
    <Drawer open={selectedDate !== null} titleId="date-override-title" onClose={() => setSelectedDate(null)}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface p-4 sm:p-6"><div><h2 id="date-override-title" className="text-xl font-semibold">日別設定</h2><p className="mt-1 text-sm text-foreground-secondary">{selectedDate && dateLabel(selectedDate)}（日付は変更不可）</p></div><button type="button" autoFocus aria-label="日別設定を閉じる" onClick={() => setSelectedDate(null)} className={adminStateActionClass}><X aria-hidden="true" className="size-5" /></button></header>
      <div className="space-y-4 p-4 sm:p-6">{draftError && <AdminFeedback kind="error" message={draftError} />}<ShiftConfigFields value={draft} onChange={setDraft} /><button type="button" onClick={() => { setDraft(base); setDraftError(undefined); }} className={adminStateActionClass}>共通設定に戻す</button><p className="text-xs text-foreground-muted">「日別設定を保存」で反映します。日付変更は閉じて追加・除外してください。</p><div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4"><button type="button" onClick={() => setSelectedDate(null)} className={adminStateActionClass}>キャンセル</button><button type="button" onClick={saveOverride} className={primary}>日別設定を保存</button></div></div>
    </Drawer>
  </div>;
}
