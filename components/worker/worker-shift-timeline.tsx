import Link from "next/link";
import type { JourneyState, JourneyType, ShiftTimelineProjection } from "@/lib/worker/journey/worker-journey";
import { WorkerJourneyActionButton } from "./worker-journey-action-button";

const dateTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const stateLabels: Record<JourneyState | "cancelled" | "unavailable", string> = {
  not_required: "不要", scheduled: "予定", not_open: "受付前", actionable: "報告できます", overdue: "報告待ち", completed: "完了", completed_late: "遅れて完了", missing_superseded: "後続の報告により終了", closed: "終了", cancelled: "取消", unavailable: "対象外",
};

export function WorkerShiftTimeline({ timeline }: { timeline: ShiftTimelineProjection }) {
  const journeyAction = timeline.nextAction && timeline.nextAction.kind !== "pre_shift_confirmation" ? timeline.nextAction : null;
  return <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="shift-timeline-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="shift-timeline-heading" className="text-lg font-semibold text-slate-950">勤務タイムライン</h2><p className="mt-1 text-sm text-slate-600">予定と実際の報告を時系列で表示します。</p></div>{timeline.nextAction && <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">次: {timeline.nextAction.label}</span>}</div>
    {timeline.nextAction && <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">次に必要なAction</p><p className="mt-1 font-semibold text-slate-950">{timeline.nextAction.label}</p>{timeline.nextAction.dueAt && <p className="mt-1 text-sm text-slate-700">目安 {dateTime.format(new Date(timeline.nextAction.dueAt))}</p>}{timeline.nextAction.state === "not_open" ? <p className="mt-2 text-sm text-slate-700">現在はまだ受付前です。</p> : journeyAction ? <WorkerJourneyActionButton assignmentId={timeline.assignmentId} journeyType={journeyAction.kind as JourneyType} /> : <Link href={timeline.nextAction.href} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">該当箇所を見る</Link>}</div>}
    <ol className="mt-5 space-y-3">{timeline.items.map((item) => <li key={item.id} id={item.type === "wake" || item.type === "departure" || item.type === "arrival" ? `journey-${item.type}` : undefined} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold text-slate-950">{item.label}</p><span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{stateLabels[item.state]}</span></div>{item.occurredAt ? <p className="mt-1 text-sm text-slate-600">報告 {dateTime.format(new Date(item.occurredAt))}</p> : item.effectiveAt ? <p className="mt-1 text-sm text-slate-600">予定 {dateTime.format(new Date(item.effectiveAt))}</p> : null}</li>)}</ol>
    <p className="mt-4 text-xs text-slate-500">到着報告と正式な勤務開始・終了は別の記録です。</p>
  </section>;
}
