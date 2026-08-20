import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const style = status === "recruiting" ? "bg-blue-50 text-blue-800" : status === "in_progress" ? "bg-amber-50 text-amber-800" : status === "completed" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${style}`}>{SHIFT_STATUS_LABELS[status]}</span>;
}
