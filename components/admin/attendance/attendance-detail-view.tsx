import Link from "next/link";
import type { AttendanceDetail } from "@/lib/admin/attendance/attendance-detail-types";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AttendanceConfirmationBadge } from "./attendance-status-badge";
import { AttendanceConfirmationForm } from "./attendance-confirmation-form";
import { AttendanceRevisionForm } from "./attendance-revision-form";

const dateTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const eventLabels: Record<string, string> = { wake_up: "起床", depart: "出発", arrive: "到着", start_work: "勤務開始", break_start: "休憩開始", break_end: "休憩終了", end_work: "勤務終了", submit: "送信" };
function localParts(value: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date(value)); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""; return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}:${get("second")}` }; }
function workMinutes(start: string, end: string, breakMinutes: number) { return Math.max(Math.floor((Date.parse(end) - Date.parse(start)) / 60_000) - breakMinutes, 0); }
function Duration({ minutes }: { minutes: number }) { return <>{Math.floor(minutes / 60)}時間{String(minutes % 60).padStart(2, "0")}分</>; }
const panel = "rounded-panel border border-border bg-surface p-4 sm:p-5";

export function AttendanceDetailView({ detail }: { detail: AttendanceDetail }) {
  const currentStart = detail.startWorkAt ?? detail.plannedStartAt;
  const currentEnd = detail.endWorkAt ?? detail.plannedEndAt;
  const startParts = localParts(currentStart); const endParts = localParts(currentEnd);
  const confirmation = detail.revisions.length ? "corrected" : detail.record ? "confirmed" : "unconfirmed";
  return (
    <AdminPage>
      <AdminPageHeader eyebrow="勤怠詳細" title={detail.workerName} description={`${detail.projectName} / ${detail.jobName} / ${detail.workplaceName}`} actions={<AttendanceConfirmationBadge state={confirmation} />} />
      <nav aria-label="関連情報" className="flex flex-wrap gap-3 text-sm">
        <Link href={`/admin/workers/${detail.workerId}`} className="inline-flex min-h-11 items-center font-medium text-link hover:underline">スタッフ詳細</Link>
        <Link href={`/admin/projects/${detail.projectId}`} className="inline-flex min-h-11 items-center font-medium text-link hover:underline">案件Hub</Link>
        <Link href={`/admin/shifts/${detail.shiftId}`} className="inline-flex min-h-11 items-center font-medium text-link hover:underline">シフト詳細</Link>
        <Link href="/admin/attendance" className="inline-flex min-h-11 items-center font-medium text-link hover:underline">勤怠一覧へ戻る</Link>
      </nav>
      <section aria-labelledby="attendance-overview" className="grid gap-4 lg:grid-cols-3">
        <h2 id="attendance-overview" className="sr-only">勤怠概要</h2>
        <div className={panel}><p className="text-sm text-foreground-muted">勤務予定</p><p className="mt-2 text-lg font-semibold">{time.format(new Date(detail.plannedStartAt))}–{time.format(new Date(detail.plannedEndAt))}</p><p className="mt-1 text-sm text-foreground-secondary">休憩 {detail.plannedBreakMinutes}分</p></div>
        <div className={panel}><p className="text-sm text-foreground-muted">Worker打刻</p><p className="mt-2 text-lg font-semibold">{detail.startWorkAt ? time.format(new Date(detail.startWorkAt)) : "—"}–{detail.endWorkAt ? time.format(new Date(detail.endWorkAt)) : "—"}</p><p className="mt-1 text-sm text-foreground-secondary">受信時刻を表示</p></div>
        <div className={panel}><p className="text-sm text-foreground-muted">正式実績</p><p className="mt-2 text-lg font-semibold">{detail.record ? <Duration minutes={workMinutes(detail.record.actualStartAt, detail.record.actualEndAt, detail.record.breakMinutes)} /> : "未確定"}</p><p className="mt-1 text-sm text-foreground-secondary">{detail.record ? `休憩 ${detail.record.breakMinutes}分` : "正式な勤怠レコードはありません"}</p></div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
        <section className={panel}>
          <h2 className="text-lg font-semibold">現在の正式勤怠</h2>
          {detail.record ? <><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[8rem_1fr]"><dt className="text-foreground-muted">実勤務</dt><dd>{dateTime.format(new Date(detail.record.actualStartAt))}〜{dateTime.format(new Date(detail.record.actualEndAt))}</dd><dt className="text-foreground-muted">休憩</dt><dd>{detail.record.breakMinutes}分</dd><dt className="text-foreground-muted">確定者</dt><dd>{detail.record.approvedByName}</dd><dt className="text-foreground-muted">確定日時</dt><dd>{dateTime.format(new Date(detail.record.approvedAt))}</dd>{detail.record.adjustmentReason && <><dt className="text-foreground-muted">補正理由</dt><dd>{detail.record.adjustmentReason}</dd></>}</dl><AttendanceRevisionForm assignmentId={detail.assignmentId} actualStartAt={detail.record.actualStartAt} actualEndAt={detail.record.actualEndAt} breakMinutes={detail.record.breakMinutes} /></> : <p className="mt-3 text-sm text-foreground-secondary">まだ正式な勤怠は確定されていません。</p>}
        </section>
        <section className={panel}>
          <h2 className="text-lg font-semibold">Raw Events</h2>
          <p className="mt-1 text-sm text-foreground-muted">Workerから受信した不変ログ</p>
          {detail.events.length ? <ol className="mt-4 space-y-3">{detail.events.map((event, index) => <li key={`${event.receivedAt}-${event.eventType}-${index}`} className="border-l-2 border-info pl-4"><p className="font-medium">{eventLabels[event.eventType] ?? event.eventType}</p><p className="text-sm text-foreground-secondary">受信 {dateTime.format(new Date(event.receivedAt))}</p><p className="text-xs text-foreground-muted">source: {event.source}{event.occurredAt ? ` / 端末時刻 ${dateTime.format(new Date(event.occurredAt))}` : ""}</p></li>)}</ol> : <p className="mt-4 text-sm text-foreground-secondary">Raw Eventはありません。</p>}
        </section>
      </div>
      {detail.record ? (
        <section className={panel}>
          <h2 className="text-lg font-semibold">訂正履歴</h2>
          <p className="mt-1 text-sm text-foreground-muted">現在値とは分離した監査履歴です。</p>
          {detail.revisions.length === 0 ? <p className="mt-4 text-sm text-foreground-secondary">訂正履歴はありません。</p> : <ol className="mt-4 space-y-4">{detail.revisions.map((revision) => { const before = workMinutes(revision.beforeActualStartAt, revision.beforeActualEndAt, revision.beforeBreakMinutes); const after = workMinutes(revision.afterActualStartAt, revision.afterActualEndAt, revision.afterBreakMinutes); return <li key={revision.id} className="rounded-card border border-border p-4"><p className="font-semibold">{revision.changedByName}・{dateTime.format(new Date(revision.changedAt))}</p><p className="mt-2 whitespace-pre-wrap text-sm">理由：{revision.reason}</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[7rem_1fr]"><dt className="text-foreground-muted">勤務開始</dt><dd>{dateTime.format(new Date(revision.beforeActualStartAt))} → {dateTime.format(new Date(revision.afterActualStartAt))}</dd><dt className="text-foreground-muted">勤務終了</dt><dd>{dateTime.format(new Date(revision.beforeActualEndAt))} → {dateTime.format(new Date(revision.afterActualEndAt))}</dd><dt className="text-foreground-muted">休憩</dt><dd>{revision.beforeBreakMinutes}分 → {revision.afterBreakMinutes}分</dd><dt className="text-foreground-muted">実働</dt><dd><Duration minutes={before} /> → <Duration minutes={after} /></dd></dl></li>; })}</ol>}
        </section>
      ) : (detail.assignmentStatus === "assigned" || detail.assignmentStatus === "confirmed") && !(detail.endWorkAt && !detail.startWorkAt) ? (
        <AttendanceConfirmationForm initial={{ assignmentId: detail.assignmentId, actualStartDate: startParts.date, actualStartTime: startParts.time, actualEndDate: endParts.date, actualEndTime: endParts.time, breakMinutes: String(detail.plannedBreakMinutes), adjustmentReason: "" }} />
      ) : <p className={panel}>この勤務は勤怠確定の対象ではありません。</p>}
    </AdminPage>
  );
}
