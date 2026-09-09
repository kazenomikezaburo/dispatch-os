"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminStateActionClass } from "@/components/admin/admin-state";
import { Drawer } from "@/components/admin/drawer";
import { operationalLabel, placementLabel, plannedBreakLabel, type DayOfItem } from "@/lib/admin/day-of/day-of-rules";
import { incidentCategoryLabels, type OperationalIncidentCategory } from "@/lib/worker/incidents/worker-incident-ui";

const dt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const stateClass = (item: DayOfItem) => item.state === "no_show" || item.state === "absent" ? "bg-danger-subtle text-danger-foreground" : item.attentionReason ? "bg-warning-subtle text-warning-foreground" : item.state === "working" ? "bg-success-subtle text-success-foreground" : "bg-surface-muted text-foreground-secondary";

export function DayOfDrawer({ item, date, closeHref }: { item: DayOfItem; date: string; closeHref: string }) {
  const router = useRouter();
  const close = () => {
    router.push(closeHref, { scroll: false });
    let attempts = 0;
    const restoreFocus = window.setInterval(() => {
      attempts += 1;
      const trigger = document.getElementById(`assignment-${item.assignmentId}`);
      trigger?.focus();
      if (document.activeElement === trigger || attempts === 10) {
        window.clearInterval(restoreFocus);
      }
    }, 50);
  };
  const placement = placementLabel(item, date);
  return <Drawer open titleId="day-of-drawer-title" onClose={close}>
    <header className="flex items-start justify-between border-b border-border p-5 sm:p-6">
      <div><p className="text-sm font-medium text-link">当日運用 / スタッフ詳細</p><h2 id="day-of-drawer-title" className="mt-1 text-xl font-semibold">{item.workerName}</h2><p className="mt-1 text-sm text-foreground-muted">{item.staffCode}</p><span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(item)}`}>{operationalLabel(item)}</span></div>
      <button autoFocus type="button" onClick={close} aria-label="スタッフ詳細を閉じる" className="inline-flex size-11 shrink-0 items-center justify-center rounded-control hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring"><X aria-hidden className="size-5" /></button>
    </header>
    <div className="space-y-6 p-5 sm:p-6">
      <section aria-labelledby="day-of-state-heading"><h3 id="day-of-state-heading" className="font-semibold">勤務状態</h3><div className="mt-3 rounded-panel border border-border bg-surface-subtle p-4"><p className="font-semibold">{operationalLabel(item)}</p>{item.startWorkAt && <p className="mt-2 text-sm">勤務開始打刻：{dt.format(new Date(item.startWorkAt))}</p>}{item.endWorkAt && <p className="mt-1 text-sm">勤務終了打刻：{dt.format(new Date(item.endWorkAt))}</p>}{item.attentionReason && <p className={`mt-3 border-l-4 p-3 text-sm font-semibold ${item.state === "no_show" || item.state === "absent" ? "border-l-danger bg-danger-subtle text-danger-foreground" : "border-l-warning bg-warning-subtle text-warning-foreground"}`}>要確認：{item.attentionReason}</p>}</div><p className="mt-2 text-xs text-foreground-muted">打刻は勤怠factです。到着状態を示すものではありません。</p></section>
      <section className="border-t border-border pt-6"><h3 className="font-semibold">勤務予定</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-foreground-muted">案件・業務</dt><dd className="mt-1">{item.projectName} / {item.jobName}</dd></div><div><dt className="text-foreground-muted">勤務先</dt><dd className="mt-1">{item.workplaceName}</dd></div><div><dt className="text-foreground-muted">予定時間</dt><dd className="mt-1">{dt.format(new Date(item.startsAt))}–{dt.format(new Date(item.endsAt))}</dd></div><div><dt className="text-foreground-muted">Assignment</dt><dd className="mt-1">{item.assignmentStatus}</dd></div></dl></section>
      <section className="border-t border-border pt-6"><h3 className="font-semibold">配置・予定休憩</h3><p className="mt-3 text-sm font-medium">{placement.value ? `${placement.prefix}：${placement.value}` : "配置設定なし"}</p>{item.placements.map((segment, index) => <p key={`${segment.startAt}-${index}`} className="mt-2 text-sm text-foreground-secondary">{segment.position} {dt.format(new Date(segment.startAt))}–{dt.format(new Date(segment.endAt))}</p>)}{item.breaks.length === 0 ? <p className="mt-2 text-sm text-foreground-muted">予定休憩なし</p> : item.breaks.map((itemBreak, index) => <p key={`${itemBreak.startAt}-${index}`} className="mt-2 text-sm">{plannedBreakLabel(item, date)} {dt.format(new Date(itemBreak.startAt))}–{dt.format(new Date(itemBreak.endAt))}</p>)}</section>
      <section className="border-t border-border pt-6"><h3 className="font-semibold">前日確認</h3><p className="mt-3 text-sm">{item.preShift ? item.preShift.canWork ? "提出済み・勤務可能" : "提出済み・勤務不可回答" : "未提出"}</p><p className="mt-2 text-xs text-foreground-muted">健康詳細・コメント・連絡先はこの画面に表示しません。</p></section>
      {item.incidentAttention&&<section className="border-t border-border pt-6"><h3 className="font-semibold">Help Request</h3><div className={`mt-3 rounded-panel border p-4 ${item.incidentAttention.state==="open"?"border-warning/30 bg-warning-subtle":"border-info/30 bg-info-subtle"}`}><p className="font-semibold">{item.incidentAttention.state==="open"?"未対応":"対応中"}</p><p className="mt-2 text-sm">{incidentCategoryLabels[item.incidentAttention.category as OperationalIncidentCategory]}</p><Link href={`/admin/incidents?incident=${item.incidentAttention.id}`} className={`${adminStateActionClass} mt-3`}>Help Requestを開く</Link></div><p className="mt-2 text-xs text-foreground-muted">勤務状態とは独立した運用上の対応項目です。</p></section>}
      <nav aria-label="関連画面" className="grid gap-2 border-t border-border pt-6 sm:grid-cols-2"><Link href={`/admin/attendance/${item.assignmentId}`} className={adminStateActionClass}>勤怠詳細</Link><Link href={`/admin/placement?date=${date}&shift=${item.shiftId}`} className={adminStateActionClass}>配置・休憩</Link><Link href={`/admin/pre-shift?date=${date}&assignment=${item.assignmentId}`} className={adminStateActionClass}>前日確認</Link><Link href={`/admin/workers/${item.workerId}`} className={adminStateActionClass}>スタッフ詳細</Link><Link href={`/admin/shifts/${item.shiftId}`} className={adminStateActionClass}>シフト詳細</Link></nav>
    </div>
  </Drawer>;
}
