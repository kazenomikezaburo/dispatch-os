"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOperationalIncident, retractOperationalIncident } from "@/app/actions/operational-incidents";
import { OPERATIONAL_INCIDENT_CATEGORIES, currentWorkerIncident, incidentCategoryDescriptions, incidentCategoryLabels, incidentStateLabels, terminalWorkerIncidents, type OperationalIncidentCategory, type WorkerOperationalIncident } from "@/lib/worker/incidents/worker-incident-ui";

type Props = {
  assignmentId: string;
  canCreate: boolean;
  context: { date: string; time: string; workplace: string; job: string };
  incidents: WorkerOperationalIncident[];
};

const timestamp = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export function HelpRequestSection({ assignmentId, canCreate, context, incidents }: Props) {
  const active = currentWorkerIncident(incidents);
  const history = terminalWorkerIncidents(incidents);
  const createDialog = useRef<HTMLDialogElement>(null);
  const retractDialog = useRef<HTMLDialogElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const retractButton = useRef<HTMLButtonElement>(null);
  const createKey = useRef<string | null>(null);
  const retractKey = useRef<string | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState<OperationalIncidentCategory | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  function open(dialog: HTMLDialogElement | null) {
    if (!dialog) return;
    document.body.style.overflow = "hidden";
    dialog.showModal();
  }
  function close(dialog: HTMLDialogElement | null, returnTo: React.RefObject<HTMLButtonElement | null>) {
    if (!dialog || isPending) return;
    dialog.close();
    document.body.style.overflow = "";
    returnTo.current?.focus();
  }
  function submitCreate() {
    if (!category) { setFieldError("困っていることを選択してください。"); return; }
    setFieldError(null); setError(null);
    createKey.current ??= crypto.randomUUID();
    startTransition(async () => {
      try {
        const result = await createOperationalIncident({ assignmentId, category, message, idempotencyKey: createKey.current! });
        if (result.ok) {
          createKey.current = null;
          createDialog.current?.close(); document.body.style.overflow = ""; router.refresh();
        } else {
          setError(result.message);
          if (result.refresh) { createDialog.current?.close(); document.body.style.overflow = ""; router.refresh(); }
          else createKey.current = null;
        }
      } catch {
        setError("通信結果を確認できませんでした。同じ内容で再度お試しください。");
      }
    });
  }
  function submitRetract() {
    if (!active || active.state !== "open") return;
    setError(null);
    retractKey.current ??= crypto.randomUUID();
    startTransition(async () => {
      try {
        const result = await retractOperationalIncident({ incidentId: active.id, assignmentId, expectedVersion: active.version, idempotencyKey: retractKey.current! });
        if (result.ok) {
          retractKey.current = null;
          retractDialog.current?.close(); document.body.style.overflow = ""; router.refresh();
        } else {
          setError(result.message);
          if (result.refresh) { retractDialog.current?.close(); document.body.style.overflow = ""; router.refresh(); }
          else retractKey.current = null;
        }
      } catch {
        setError("通信結果を確認できませんでした。同じ操作を再度お試しください。");
      }
    });
  }

  if (!canCreate && incidents.length === 0) return null;

  return <section aria-labelledby="help-request-heading" className="rounded-xl border border-border bg-surface p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="help-request-heading" className="text-lg font-semibold text-foreground">困ったとき</h2><p className="mt-1 text-sm text-foreground-secondary">この勤務について、管理者の対応が必要なことを伝えられます。</p></div>
      {!active && canCreate && <button ref={createButton} type="button" onClick={() => open(createDialog.current)} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-foreground-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">助けを求める</button>}
    </div>
    {error && <p role="status" className="mt-4 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-foreground">{error}</p>}
    {active && <div className="mt-5"><IncidentCard incident={active} current />{active.state === "open" && <button ref={retractButton} type="button" onClick={() => open(retractDialog.current)} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-danger/30 bg-surface px-4 text-sm font-semibold text-danger hover:bg-danger-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">取り下げる</button>}</div>}
    {history.length > 0 && <div className="mt-6 border-t border-border-subtle pt-5"><h3 className="text-sm font-semibold text-foreground">これまでのHelp Request</h3><ul className="mt-3 space-y-3">{history.map((incident) => <li key={incident.id}><IncidentCard incident={incident} /></li>)}</ul></div>}

    <dialog ref={createDialog} aria-labelledby="help-request-dialog-title" onCancel={(event) => { event.preventDefault(); close(createDialog.current, createButton); }} onClick={(event) => { if (event.target === event.currentTarget) close(createDialog.current, createButton); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-0 text-foreground shadow-ds-overlay backdrop:bg-[var(--surface-overlay)]">
      <form action={submitCreate} className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 id="help-request-dialog-title" className="text-xl font-semibold">助けを求める</h2><p className="mt-1 text-sm text-foreground-secondary">{context.date} {context.time}<br />{context.workplace} / {context.job}</p></div><button type="button" aria-label="閉じる" disabled={isPending} onClick={() => close(createDialog.current, createButton)} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-xl text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring disabled:text-foreground-disabled">×</button></div>
        <fieldset className="mt-6" aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "incident-category-error" : undefined}><legend className="font-semibold">困っていること <span className="text-danger">*</span></legend><div className="mt-3 grid gap-2">{OPERATIONAL_INCIDENT_CATEGORIES.map((value, index) => <label key={value} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-border-strong px-4 py-3 focus-within:border-focus-ring focus-within:ring-2 focus-within:ring-focus-ring/20"><input autoFocus={index === 0} type="radio" name="category" value={value} checked={category === value} disabled={isPending} onChange={() => setCategory(value)} className="mt-1" /><span><span className="block font-medium">{incidentCategoryLabels[value]}</span><span className="mt-0.5 block text-xs text-foreground-muted">{incidentCategoryDescriptions[value]}</span></span></label>)}</div>{fieldError && <p id="incident-category-error" className="mt-2 text-sm text-danger">{fieldError}</p>}</fieldset>
        <div className="mt-5"><label htmlFor="incident-message" className="font-semibold">状況 <span className="text-sm font-normal text-foreground-muted">（任意）</span></label><textarea id="incident-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} disabled={isPending} rows={4} placeholder="状況を必要な範囲で入力してください" className="mt-2 w-full resize-y rounded-lg border border-border-strong bg-surface px-3 py-3 focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/20 disabled:bg-surface-muted" /><p className="mt-1 text-right text-xs text-foreground-muted">{message.length} / 500</p></div>
        <p className="mt-4 text-xs leading-5 text-foreground-muted">病名などの詳しい医療情報、電話番号、住所、パスワード、不要な位置情報は入力しないでください。</p>
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-6 grid gap-2 sm:grid-cols-2 sm:[&>*:first-child]:order-2"><button type="submit" disabled={isPending} className="min-h-12 rounded-lg bg-primary px-5 font-semibold text-foreground-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:bg-surface-muted disabled:text-foreground-disabled">{isPending ? "送信中…" : "送信する"}</button><button type="button" disabled={isPending} onClick={() => close(createDialog.current, createButton)} className="min-h-12 rounded-lg border border-border-strong bg-surface px-5 font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:text-foreground-disabled">キャンセル</button></div>
      </form>
    </dialog>

    <dialog ref={retractDialog} aria-labelledby="retract-dialog-title" onCancel={(event) => { event.preventDefault(); close(retractDialog.current, retractButton); }} onClick={(event) => { if (event.target === event.currentTarget) close(retractDialog.current, retractButton); }} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-surface p-0 text-foreground shadow-ds-overlay backdrop:bg-[var(--surface-overlay)]">
      <form action={submitRetract} className="p-5 sm:p-6"><h2 id="retract-dialog-title" className="text-lg font-semibold">このHelp Requestを取り下げますか？</h2><p className="mt-2 text-sm text-foreground-secondary">内容は削除されず、「取り下げ済み」として履歴に残ります。</p>{error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}<div className="mt-6 grid gap-2"><button autoFocus type="submit" disabled={isPending} className="min-h-12 rounded-lg bg-danger px-5 font-semibold text-foreground-inverse hover:bg-danger-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:bg-surface-muted disabled:text-foreground-disabled">{isPending ? "取り下げ中…" : "取り下げる"}</button><button type="button" disabled={isPending} onClick={() => close(retractDialog.current, retractButton)} className="min-h-12 rounded-lg border border-border-strong px-5 font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">キャンセル</button></div></form>
    </dialog>
  </section>;
}

function IncidentCard({ incident, current = false }: { incident: WorkerOperationalIncident; current?: boolean }) {
  const statusTone = incident.state === "open" ? "border-warning/30 bg-warning-subtle" : incident.state === "acknowledged" ? "border-info/30 bg-info-subtle" : "border-border bg-surface-subtle";
  const stateTime = incident.state === "acknowledged" ? incident.acknowledgedAt : incident.state === "resolved" ? incident.resolvedAt : incident.state === "retracted" ? incident.retractedAt : null;
  return <article className={`rounded-xl border p-4 ${statusTone}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{current ? "現在のHelp Request" : incidentCategoryLabels[incident.category]}</p><span className="rounded-full border border-current/15 px-2.5 py-1 text-xs font-semibold">{incidentStateLabels[incident.state]}</span></div>{current && <p className="mt-3 text-sm font-semibold">{incidentCategoryLabels[incident.category]}</p>}{incident.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground-secondary">{incident.message}</p>}<dl className="mt-3 grid gap-1 text-xs text-foreground-muted"><div><dt className="inline">送信日時: </dt><dd className="inline">{timestamp.format(new Date(incident.createdAt))}</dd></div>{stateTime && <div><dt className="inline">{incident.state === "acknowledged" ? "確認日時" : incident.state === "resolved" ? "解決日時" : "取り下げ日時"}: </dt><dd className="inline">{timestamp.format(new Date(stateTime))}</dd></div>}</dl>{incident.state === "open" && <p className="mt-3 text-sm text-foreground-secondary">送信済みです。管理者が確認するまでお待ちください。</p>}{incident.state === "acknowledged" && <p className="mt-3 text-sm text-foreground-secondary">管理者が確認し、対応しています。</p>}</article>;
}
