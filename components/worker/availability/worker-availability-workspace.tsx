"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { correctOwnAvailability, createOwnAvailability, retireOwnAvailability, setOwnWorkConditions } from "@/app/actions/worker-availability";
import type { AvailabilityInterval, AvailabilityKind, WorkerAvailabilityData } from "@/lib/worker/availability/types";

const kindMeta: Record<AvailabilityKind, { symbol: string; label: string; tone: string }> = {
  available: { symbol: "○", label: "勤務可能", tone: "text-success" },
  consultable: { symbol: "△", label: "相談可能", tone: "text-warning" },
  unavailable: { symbol: "×", label: "勤務不可", tone: "text-danger" },
};
const weekdays = [{ id: 1, label: "月" }, { id: 2, label: "火" }, { id: 3, label: "水" }, { id: 4, label: "木" }, { id: 5, label: "金" }, { id: 6, label: "土" }, { id: 7, label: "日" }];
const dateTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

function toTokyoLocal(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function WorkerAvailabilityWorkspace({ data }: { data: WorkerAvailabilityData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AvailabilityInterval | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const conditions = data.workConditions;

  function run(task: () => Promise<{ ok: boolean; message?: string }>, success: string, after?: () => void) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) return setMessage({ kind: "error", text: result.message ?? "更新できませんでした。" });
      setMessage({ kind: "success", text: success });
      after?.();
      router.refresh();
    });
  }

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-control bg-info-subtle text-info"><CalendarClock aria-hidden className="size-5" /></span><div><h1 className="text-2xl font-semibold text-foreground">勤務可能時間・希望条件</h1><p className="mt-1 text-sm text-foreground-secondary">勤務できる日時と、配置時に参考にする希望を登録します。</p></div></div>
    {message && <p role="status" className={`mt-5 rounded-control p-3 text-sm ${message.kind === "success" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}>{message.text}</p>}
    <section aria-labelledby="availability-title" className="mt-6 rounded-panel border border-border bg-surface p-4 sm:p-6">
      <h2 id="availability-title" className="text-lg font-semibold">勤務可能時間</h2>
      <p className="mt-1 text-sm text-foreground-muted">日付ごとの実時間を登録します。○ 勤務可能／△ 相談可能／× 勤務不可。登録がない時間は「不明」です。</p>
      <IntervalForm key={editing?.id ?? "create"} editing={editing} pending={pending} onCancel={() => setEditing(null)} onSubmit={(value) => run(() => editing ? correctOwnAvailability({ intervalId: editing.id, ...value }) : createOwnAvailability(value), editing ? "勤務可能時間を修正しました。" : "勤務可能時間を追加しました。", () => setEditing(null))} />
      <div className="mt-6 border-t border-border pt-5"><h3 className="font-semibold">現在の登録</h3>{data.intervals.length ? <ul className="mt-3 space-y-3">{data.intervals.map(interval => <li key={interval.id} className="rounded-control border border-border bg-surface-subtle p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className={`font-semibold ${kindMeta[interval.kind].tone}`}><span aria-hidden>{kindMeta[interval.kind].symbol}</span> {kindMeta[interval.kind].label}</p><p className="mt-1 text-sm text-foreground-secondary">{dateTime.format(new Date(interval.startsAt))} ～ {dateTime.format(new Date(interval.endsAt))}</p></div><div className="flex gap-2"><button type="button" disabled={pending} onClick={() => setEditing(interval)} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-hover disabled:opacity-50"><Pencil aria-hidden className="size-4" />修正</button><button type="button" disabled={pending} onClick={() => run(() => retireOwnAvailability(interval.id), "勤務可能時間を取り下げました。", () => editing?.id === interval.id && setEditing(null))} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-danger text-danger px-3 text-sm font-medium hover:bg-danger-subtle disabled:opacity-50"><Trash2 aria-hidden className="size-4" />取下げ</button></div></div></li>)}</ul> : <p className="mt-3 rounded-control bg-surface-subtle p-4 text-sm text-foreground-secondary">登録はありません。勤務可能状態は「不明」として扱われます。</p>}</div>
    </section>
    <WorkConditionsForm conditions={conditions} pending={pending} onSubmit={(value) => run(() => setOwnWorkConditions(value), "希望条件を保存しました。")} />
  </main>;
}

function IntervalForm({ editing, pending, onCancel, onSubmit }: { editing: AvailabilityInterval | null; pending: boolean; onCancel: () => void; onSubmit: (value: { kind: AvailabilityKind; startsAtLocal: string; endsAtLocal: string }) => void }) {
  const [kind, setKind] = useState<AvailabilityKind>(editing?.kind ?? "available");
  const [startsAtLocal, setStartsAtLocal] = useState(editing ? toTokyoLocal(editing.startsAt) : "");
  const [endsAtLocal, setEndsAtLocal] = useState(editing ? toTokyoLocal(editing.endsAt) : "");
  return <form className="mt-5 rounded-control bg-surface-subtle p-4" onSubmit={event => { event.preventDefault(); onSubmit({ kind, startsAtLocal, endsAtLocal }); }}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">状態<select value={kind} onChange={event => setKind(event.target.value as AvailabilityKind)} className="mt-1 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3"><option value="available">○ 勤務可能</option><option value="consultable">△ 相談可能</option><option value="unavailable">× 勤務不可</option></select></label><label className="text-sm font-medium">開始日時（日本時間）<input required type="datetime-local" value={startsAtLocal} onChange={event => setStartsAtLocal(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3" /></label><label className="text-sm font-medium">終了日時（日本時間）<input required type="datetime-local" value={endsAtLocal} onChange={event => setEndsAtLocal(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3" /></label></div><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{editing && <button type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-control border border-border-strong px-4 text-sm font-medium">修正をやめる</button>}<button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-info px-4 text-sm font-semibold text-foreground-inverse disabled:opacity-50">{editing ? <RotateCcw aria-hidden className="size-4" /> : null}{pending ? "処理中…" : editing ? "修正を保存" : "追加"}</button></div></form>;
}

function WorkConditionsForm({ conditions, pending, onSubmit }: { conditions: WorkerAvailabilityData["workConditions"]; pending: boolean; onSubmit: (value: { preferredIsoWeekdays: number[]; preferredStartLocal: string | null; preferredEndLocal: string | null; preferredEndsNextDay: boolean; preferredAreaNote: string | null; preferredWorkCategoryNote: string | null; transportPreferenceNote: string | null }) => void }) {
  const [days, setDays] = useState<number[]>(conditions?.preferredIsoWeekdays ?? []);
  const [start, setStart] = useState(conditions?.preferredStartLocal ?? "");
  const [end, setEnd] = useState(conditions?.preferredEndLocal ?? "");
  const [overnight, setOvernight] = useState(conditions?.preferredEndsNextDay ?? false);
  const [area, setArea] = useState(conditions?.preferredAreaNote ?? "");
  const [category, setCategory] = useState(conditions?.preferredWorkCategoryNote ?? "");
  const [transport, setTransport] = useState(conditions?.transportPreferenceNote ?? "");
  return <section aria-labelledby="conditions-title" className="mt-6 rounded-panel border border-border bg-surface p-4 sm:p-6"><h2 id="conditions-title" className="text-lg font-semibold">希望条件</h2><p className="mt-1 text-sm text-foreground-muted">配置時の参考情報です。不一致でも自動的に候補外にはなりません。</p><form className="mt-5 space-y-5" onSubmit={event => { event.preventDefault(); onSubmit({ preferredIsoWeekdays: days, preferredStartLocal: start || null, preferredEndLocal: end || null, preferredEndsNextDay: overnight, preferredAreaNote: area || null, preferredWorkCategoryNote: category || null, transportPreferenceNote: transport || null }); }}><fieldset><legend className="text-sm font-medium">希望曜日</legend><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdays.map(day => <label key={day.id} className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface-subtle text-sm"><input type="checkbox" checked={days.includes(day.id)} onChange={() => setDays(current => current.includes(day.id) ? current.filter(value => value !== day.id) : [...current, day.id].sort())} />{day.label}</label>)}</div></fieldset><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">希望開始時刻<input type="time" value={start} onChange={event => setStart(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-border-strong px-3" /></label><label className="text-sm font-medium">希望終了時刻<input type="time" value={end} onChange={event => setEnd(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-border-strong px-3" /></label></div><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={overnight} onChange={event => setOvernight(event.target.checked)} />終了時刻は翌日</label><NoteField label="希望エリア（参考）" value={area} onChange={setArea} /><NoteField label="希望業務（参考）" value={category} onChange={setCategory} /><NoteField label="交通手段（参考）" value={transport} onChange={setTransport} /><div className="flex justify-end"><button type="submit" disabled={pending} className="min-h-11 rounded-control bg-info px-5 text-sm font-semibold text-foreground-inverse disabled:opacity-50">{pending ? "保存中…" : "希望条件を保存"}</button></div></form></section>;
}

function NoteField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium">{label}<textarea rows={2} maxLength={500} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-control border border-border-strong p-3" /></label>; }
