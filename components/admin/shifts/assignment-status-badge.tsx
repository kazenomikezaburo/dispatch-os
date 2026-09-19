import type { AssignmentStatus } from "@/lib/admin/shifts/shift-detail-types";
import { AdminStatusBadge } from "@/components/admin/admin-visual-primitives";

const labels: Record<AssignmentStatus, string> = { assigned: "配置済み", confirmed: "確認済み", completed: "勤務完了", cancelled_by_worker: "スタッフ都合取消", cancelled_by_company: "会社都合取消", absent: "欠勤", no_show: "無断欠勤" };
export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const tone = status === "completed" || status === "confirmed" ? "success" : status === "absent" ? "warning" : status === "no_show" ? "danger" : status.startsWith("cancelled") ? "neutral" : "info";
  return <AdminStatusBadge tone={tone}>{labels[status]}</AdminStatusBadge>;
}
