import Link from "next/link";
import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import type { ShiftListItem } from "@/lib/admin/shifts/shift-list-types";
import { shiftTimeLabel } from "@/lib/admin/shifts/shift-view-rules";

export function ShiftPreviewCard({ shift, compact = false }: { shift: ShiftListItem; compact?: boolean }) {
  return <Link href={`/admin/shifts/${shift.id}`} className={`block min-h-11 min-w-0 rounded-control border border-border border-l-2 p-2 text-sm lg:text-xs hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${shift.shortage > 0 ? "border-l-warning bg-warning-subtle" : "border-l-border-strong bg-surface"}`}>
    <span className="block font-semibold tabular-nums leading-5">{shiftTimeLabel(shift)}</span>
    <span className={`${compact ? "line-clamp-1" : "line-clamp-2"} break-all font-medium leading-5`} title={shift.projectName}>{shift.projectName}</span>
    <span className="line-clamp-1 break-all leading-5 text-foreground-secondary" title={shift.jobName}>{shift.jobName}</span>
    {!compact && <span className="mt-1 block truncate text-foreground-muted" title={shift.workplaceName}>{shift.workplaceName}</span>}
    <span className="mt-2 flex flex-wrap gap-x-2 gap-y-1 leading-5"><span>{SHIFT_STATUS_LABELS[shift.status]}</span><span className={shift.shortage > 0 ? "font-semibold text-warning-foreground" : "text-foreground-secondary"}>{shift.shortage > 0 ? `不足 ${shift.shortage}名` : "不足なし"}</span></span>
    {!compact && <span className="mt-1 block tabular-nums text-foreground-secondary">配置 {shift.assignedWorkers} / 必要 {shift.requiredWorkers}名</span>}
  </Link>;
}
