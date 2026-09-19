import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";
import { AdminStatusBadge, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

const tone: Record<ShiftStatus, AdminVisualTone> = { draft: "neutral", recruiting: "info", closed: "warning", confirmed: "success", in_progress: "warning", completed: "success", cancelled: "danger" };

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  return <AdminStatusBadge tone={tone[status]}>{SHIFT_STATUS_LABELS[status]}</AdminStatusBadge>;
}
