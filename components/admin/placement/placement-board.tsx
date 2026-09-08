import Link from "next/link";
import { adminStateActionClass } from "@/components/admin/admin-state";
import { AssignmentStatusBadge } from "@/components/admin/shifts/assignment-status-badge";
import { ShiftStatusBadge } from "@/components/admin/shifts/shift-status-badge";
import { placementHref, summarizePlacement } from "@/lib/admin/placement/placement-rules";
import type { PlacementQuery, PlacementShift } from "@/lib/admin/placement/placement-types";
import { shiftTimeLabel } from "@/lib/admin/shifts/shift-view-rules";

const objectLinkClass = "inline-flex min-h-11 min-w-0 items-center rounded-control py-2 text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function PlacementSummary({ shifts }: { shifts: PlacementShift[] }) {
  const summary = summarizePlacement(shifts);
  const metrics = [
    { label: "対象シフト", value: summary.shifts, unit: "件" },
    { label: "必要人数", value: summary.required, unit: "名" },
    { label: "配置済み", value: summary.assigned, unit: "名" },
    { label: "不足人数", value: summary.shortage, unit: "名", attention: summary.shortage > 0 },
    { label: "充足シフト", value: summary.filled, unit: "件" },
    { label: "不足シフト", value: summary.shortageShifts, unit: "件", attention: summary.shortageShifts > 0 },
  ];
  return (
    <section aria-label="配置サマリー">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-panel border border-border bg-surface p-4">
            <dt className="text-sm text-foreground-muted">{metric.label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${metric.attention ? "text-danger" : "text-foreground"}`}>
              {metric.value}<span className="ml-1 text-xs font-normal text-foreground-muted">{metric.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-foreground-muted">絞り込み後の全シフトを集計。人数はシフトごとの延べ人数です。</p>
    </section>
  );
}

export function PlacementBoard({ shifts, query }: { shifts: PlacementShift[]; query: PlacementQuery }) {
  return (
    <ul aria-label="シフトごとの配置" className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">
      {shifts.map((shift) => (
        <li key={shift.id} className="grid min-w-0 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1.2fr)] xl:gap-6 xl:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ShiftStatusBadge status={shift.status} />
              <span className={`inline-flex rounded-pill px-2.5 py-1 text-xs font-medium ${shift.shortage > 0 ? "bg-danger-subtle text-danger-foreground" : "bg-success-subtle text-success-foreground"}`}>
                {shift.shortage > 0 ? `${shift.shortage}名不足` : "充足"}
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold">
              <Link href={`/admin/shifts/${shift.id}`} className={`${objectLinkClass} flex-col items-start`}>
                <span className="break-words tabular-nums">{shiftTimeLabel(shift)}</span>
                <span className="mt-1 break-words">{shift.jobName}</span>
              </Link>
            </h3>
            <Link href={`/admin/projects/${shift.projectId}`} className={`${objectLinkClass} text-sm`}>
              <span className="break-words">{shift.projectName}</span>
            </Link>
            <p className="break-words text-sm text-foreground-secondary">勤務先：{shift.workplaceName}</p>
            <p className="mt-2 text-xs text-foreground-muted">予定休憩：{shift.breakMinutes === null ? "未設定" : `${shift.breakMinutes}分`}（シフト共通）</p>
            <div className="mt-3 rounded-control bg-surface-subtle p-3 text-xs"><p className="font-medium">{shift.planSummary ? (shift.planSummary.warningCount ? "要確認" : "配置設定あり") : "未設定"}</p>{shift.planSummary?.positions.length ? <><ul className="mt-1 space-y-1">{shift.planSummary.positions.slice(0,3).map((position)=><li key={position.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{position.label}</span><span className="shrink-0 tabular-nums">{position.placedWorkers} / {position.requiredWorkers ?? "–"}</span></li>)}</ul>{shift.planSummary.positions.length > 3 && <p className="mt-1 text-foreground-muted">ほか{shift.planSummary.positions.length - 3}件</p>}</> : <p className="mt-1 text-foreground-muted">ポジション未設定</p>}</div>
          </div>
          <div className="min-w-0">
            <dl className="grid grid-cols-3 gap-2 rounded-control bg-surface-subtle p-3">
              {[
                { label: "必要", value: shift.requiredWorkers },
                { label: "配置", value: shift.assignedWorkers },
                { label: "不足", value: shift.shortage },
              ].map((metric) => (
                <div key={metric.label}>
                  <dt className="text-xs text-foreground-muted">{metric.label}</dt>
                  <dd className={`mt-1 text-lg font-semibold tabular-nums ${metric.label === "不足" && metric.value > 0 ? "text-danger" : "text-foreground"}`}>
                    {metric.value}<span className="ml-0.5 text-xs font-normal">名</span>
                  </dd>
                </div>
              ))}
            </dl>
            <Link href={`/admin/shifts/${shift.id}#shift-applications`} className={`${adminStateActionClass} mt-3 w-full`}>応募者を見る</Link>
            {shift.status !== "cancelled" && <Link id={`placement-edit-${shift.id}`} href={placementHref(query, { shift: shift.id })} scroll={false} className={`${adminStateActionClass} mt-2 w-full`}>配置・休憩を編集</Link>}
          </div>
          <section aria-label={`${shift.jobName}の配置スタッフ`} className="min-w-0 border-t border-border-subtle pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            <h4 className="text-sm font-semibold">配置スタッフ <span className="font-normal text-foreground-muted">{shift.assignedWorkers}名</span></h4>
            {shift.staff.length === 0 ? (
              <p className="mt-3 text-sm text-foreground-muted">配置スタッフはいません。応募者をシフト画面で確認できます。</p>
            ) : (
              <ul className="mt-1 divide-y divide-border-subtle">
                {shift.staff.map((staff) => (
                  <li key={staff.assignmentId} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                    {staff.worker ? (
                      <Link href={`/admin/workers/${staff.worker.id}`} className={`${objectLinkClass} min-w-0 flex-1 flex-col items-start text-sm`}>
                        <span className="break-words font-medium">{staff.worker.name}</span>
                        <span className="mt-0.5 break-all text-xs text-foreground-muted">{staff.worker.staffCode}</span>
                      </Link>
                    ) : <p className="min-w-0 flex-1 py-3 text-sm text-foreground-muted">スタッフ情報を表示できません</p>}
                    <AssignmentStatusBadge status={staff.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </li>
      ))}
    </ul>
  );
}

export function PlacementPagination({ query, page, pages }: { query: PlacementQuery; page: number; pages: number }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="配置一覧のページ" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? <Link href={placementHref(query, { page: page - 1 })} className={adminStateActionClass}>前のページ</Link> : <span aria-disabled="true" className={`${adminStateActionClass} text-foreground-disabled`}>前のページ</span>}
      <p aria-current="page" className="text-sm tabular-nums">{page} / {pages}ページ</p>
      {page < pages ? <Link href={placementHref(query, { page: page + 1 })} className={adminStateActionClass}>次のページ</Link> : <span aria-disabled="true" className={`${adminStateActionClass} text-foreground-disabled`}>次のページ</span>}
    </nav>
  );
}
