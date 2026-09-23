import { AssignmentStatusBadge } from "@/components/admin/shifts/assignment-status-badge";
import { PlacementEditorLink } from "./placement-focus-restore";
import { TimeBandCoverage } from "./time-band-coverage";
import { plannedMinutes, placementCoverageShortages, toTimeValue } from "@/lib/admin/placement/placement-editor-rules";
import type { PlacementPlan } from "@/lib/admin/placement/placement-types";

export function ShiftPlacementSurface({ plan, baseHref, candidateHref }: { plan: PlacementPlan; baseHref: string; candidateHref: string }) {
  const activePositions = plan.positions.filter((position) => !position.retired).sort((a, b) => a.displayOrder - b.displayOrder);
  const placedAssignments = new Set(plan.segments.map((segment) => segment.assignmentId)).size;
  const unassigned = Math.max(plan.assignments.length - placedAssignments, 0);
  const coverageShortages = placementCoverageShortages(plan);

  return <div className="space-y-6">
    <section aria-label="配置サマリー" className="grid gap-3 sm:grid-cols-4">
      {[
        ["必要人数", plan.requiredWorkers],
        ["対象スタッフ", plan.assignments.length],
        ["配置済み", placedAssignments],
        ["未配置", unassigned],
      ].map(([label, value]) => <div key={label} className="rounded-card border border-border bg-surface p-4"><p className="text-xs font-medium text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}<span className="ml-1 text-xs font-normal">名</span></p></div>)}
    </section>

    <section aria-labelledby="placement-positions-heading" className="rounded-panel border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="placement-positions-heading" className="text-lg font-semibold">配置ポジション</h2><p className="mt-1 text-sm text-foreground-muted">Version {plan.version}・{toTimeValue(plan.startsAt)}–{toTimeValue(plan.endsAt)}</p></div><div className="flex flex-wrap gap-2"><PlacementEditorLink id="candidate-picker-trigger" href={candidateHref}>候補を探す</PlacementEditorLink><PlacementEditorLink id="placement-create-trigger" href={`${baseHref}&placement=create`}>配置を追加</PlacementEditorLink></div></div>
      {activePositions.length === 0 ? <p className="mt-4 rounded-control bg-surface-subtle p-4 text-sm text-foreground-muted">配置ポジションは未設定です。配置を追加してプランを作成できます。</p> : <ul className="mt-4 grid gap-3 md:grid-cols-2">{activePositions.map((position) => {
        const shortage = coverageShortages.filter((item) => item.position.id === position.id).length;
        const workers = new Set(plan.segments.filter((segment) => segment.positionId === position.id).map((segment) => segment.assignmentId)).size;
        return <li key={position.id} className="rounded-card bg-surface-subtle p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{position.label}</p><p className="mt-1 text-xs text-foreground-muted">配置 {workers}名 / 必要 {position.requiredWorkers ?? "未設定"}</p></div><span className={`text-xs font-semibold ${shortage ? "text-danger" : "text-success"}`}>{shortage ? `不足時間帯 ${shortage}件` : "Coverage充足"}</span></div></li>;
      })}</ul>}
    </section>

    <TimeBandCoverage plan={plan} />

    <section aria-labelledby="placement-staff-heading" className="rounded-panel border border-border bg-surface p-4 sm:p-5">
      <h2 id="placement-staff-heading" className="text-lg font-semibold">スタッフ配置</h2>
      {plan.assignments.length === 0 ? <p className="mt-4 rounded-control bg-surface-subtle p-4 text-sm text-foreground-muted">配置対象のAssignmentはありません。</p> : <ul className="mt-3 divide-y divide-border">{plan.assignments.map((assignment) => {
        const segments = plan.segments.filter((segment) => segment.assignmentId === assignment.assignmentId);
        const breaks = plan.breaks.filter((item) => item.assignmentId === assignment.assignmentId);
        return <li key={assignment.assignmentId} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">{assignment.worker?.name ?? "スタッフ情報を表示できません"}</p><p className="mt-1 text-xs text-foreground-muted">配置 {plannedMinutes(segments)}分・休憩 {plannedMinutes(breaks)}分</p><div className="mt-2"><AssignmentStatusBadge status={assignment.status} /></div></div><PlacementEditorLink id={`placement-assignment-${assignment.assignmentId}`} href={`${baseHref}&assignmentId=${encodeURIComponent(assignment.assignmentId)}`}>配置を編集</PlacementEditorLink></li>;
      })}</ul>}
    </section>
  </div>;
}
