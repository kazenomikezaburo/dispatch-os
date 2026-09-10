"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, ChevronRight, X } from "lucide-react";
import { loadMoreWorkerNotifications, openWorkerNotification } from "@/app/actions/worker-notifications";
import { DialogFocusGuard, trapDialogFocus } from "@/components/admin/dialog-focus";
import type { WorkerNotification, WorkerNotificationCursor } from "@/lib/worker/notifications/worker-notification-types";

const typeLabels = {
  incident_acknowledged: "対応開始",
  incident_resolved: "解決済み",
  announcement_published: "お知らせ",
} as const;
const date = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function WorkerNotificationInbox({
  initialNotifications,
  initialCursor,
}: {
  initialNotifications: WorkerNotification[];
  initialCursor: WorkerNotificationCursor | null;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [cursor, setCursor] = useState(initialCursor);
  const [selected, setSelected] = useState<WorkerNotification | null>(null);
  const [sourceKind, setSourceKind] = useState<"assignment" | "announcement" | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<"available" | "unavailable" | "error">("unavailable");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) dialog.showModal();
    if (!selected && dialog.open) dialog.close();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [selected]);

  function close() {
    setSelected(null);
    setSourceKind(null);
    setSourceId(null);
    setSourceStatus("unavailable");
    setError(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  function open(notification: WorkerNotification, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setPendingId(notification.id);
    setError(null);
    startTransition(async () => {
      const result = await openWorkerNotification(notification.id);
      setPendingId(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const opened = { ...notification, readAt: notification.readAt ?? result.readAt };
      setNotifications((items) => items.map((item) => item.id === opened.id ? opened : item));
      setSourceKind(result.sourceKind);
      setSourceId(result.sourceId);
      setSourceStatus(result.sourceStatus);
      setSelected(opened);
      router.refresh();
    });
  }

  function loadMore() {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const result = await loadMoreWorkerNotifications(cursor);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotifications((items) => [...items, ...result.page.notifications]);
      setCursor(result.page.nextCursor);
    });
  }

  if (notifications.length === 0) {
    return <section className="mt-6 rounded-card border border-border bg-surface px-5 py-10 text-center"><Bell aria-hidden className="mx-auto size-7 text-foreground-muted" /><h2 className="mt-3 font-semibold">新しい通知はありません</h2><p className="mt-1 text-sm text-foreground-muted">対応状況や管理者からのお知らせがあると、ここに表示されます。</p></section>;
  }

  return <>
    {error && <p role="alert" className="mt-4 rounded-control bg-danger-subtle p-3 text-sm text-danger-foreground">{error}</p>}
    <ul aria-label="通知一覧" className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
      {notifications.map((notification) => <li key={notification.id} className="border-b border-border last:border-b-0">
        <button
          type="button"
          disabled={isPending}
          aria-label={`${notification.readAt ? "既読" : "未読"}の通知「${notification.title}」を開く`}
          onClick={(event) => open(notification, event.currentTarget)}
          className={`group flex min-h-24 w-full items-start gap-3 px-4 py-4 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-wait disabled:opacity-60 sm:px-5 ${notification.readAt ? "" : "bg-info-subtle/45"}`}
        >
          <span aria-hidden className={`mt-1 size-2.5 shrink-0 rounded-pill ${notification.readAt ? "bg-border-strong" : "bg-info"}`} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={notification.readAt ? "font-medium" : "font-semibold"}>{notification.title}</span>
              <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground-secondary">{typeLabels[notification.type]}</span>
              <span className="text-xs font-semibold text-foreground-muted">{notification.readAt ? "既読" : "未読"}</span>
            </span>
            <span className="mt-1.5 line-clamp-2 block text-sm text-foreground-secondary">{notification.summary}</span>
            <time dateTime={notification.createdAt} className="mt-2 block text-xs text-foreground-muted">{date.format(new Date(notification.createdAt))}</time>
          </span>
          {pendingId === notification.id ? <span className="mt-1 text-xs text-foreground-muted">読込中</span> : <ChevronRight aria-hidden className="mt-1 size-5 shrink-0 text-foreground-muted group-hover:text-foreground" />}
        </button>
      </li>)}
    </ul>
    {cursor && <div className="mt-5 text-center"><button type="button" disabled={isPending} onClick={loadMore} className="min-h-11 rounded-control border border-border-strong bg-surface px-5 text-sm font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:text-foreground-disabled">{isPending && !pendingId ? "読み込み中…" : "もっと見る"}</button></div>}

    <dialog ref={dialogRef} aria-labelledby="worker-notification-detail-title" onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => trapDialogFocus(event)} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-none w-full max-w-2xl overflow-y-auto border-l border-border bg-background p-0 text-foreground shadow-ds-overlay backdrop:bg-[var(--surface-overlay)] open:flex open:flex-col">
      <DialogFocusGuard edge="start" />
      {selected && <>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-7">
          <div><p className="text-sm font-semibold text-link">通知</p><h2 id="worker-notification-detail-title" className="mt-1 text-xl font-semibold sm:text-2xl">{selected.title}</h2></div>
          <button autoFocus type="button" onClick={close} aria-label="通知詳細を閉じる" className="flex size-11 shrink-0 items-center justify-center rounded-control hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring"><X aria-hidden className="size-5" /></button>
        </header>
        <div className="flex-1 space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs font-semibold">{typeLabels[selected.type]}</span><span className="text-sm font-semibold text-foreground-secondary">既読</span><time dateTime={selected.createdAt} className="text-sm text-foreground-muted">{date.format(new Date(selected.createdAt))}</time></div>
          <section className="rounded-card border border-border bg-surface p-5"><h3 className="font-semibold">内容</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground-secondary">{selected.summary}</p></section>
          <section className="rounded-card border border-border bg-surface p-5"><h3 className="font-semibold">{sourceKind === "announcement" ? "関連するお知らせ" : "関連する勤務"}</h3>{sourceId ? <><p className="mt-2 text-sm text-foreground-secondary">{sourceKind === "announcement" ? "公開中のお知らせ本文を確認できます。" : "このお知らせに関連する勤務情報を確認できます。"}</p><Link href={sourceKind === "announcement" ? `/worker/announcements/${sourceId}` : `/worker/assignments/${sourceId}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:w-auto">{sourceKind === "announcement" ? "お知らせを確認する" : "勤務詳細を確認する"}</Link></> : sourceStatus === "error" ? <p role="alert" className="mt-2 rounded-control bg-danger-subtle p-3 text-sm text-danger-foreground">関連情報を確認できませんでした。詳細を閉じて、もう一度お試しください。</p> : <p className="mt-2 rounded-control bg-surface-muted p-3 text-sm text-foreground-secondary" aria-disabled="true">{sourceKind === "announcement" ? "このお知らせは現在表示できません" : "関連する勤務情報は現在表示できません"}</p>}</section>
        </div>
      </>}
      <DialogFocusGuard edge="end" />
    </dialog>
  </>;
}
