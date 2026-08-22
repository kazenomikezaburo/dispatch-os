import type { AssignmentStatus } from "@/lib/admin/shifts/shift-detail-types";

const labels: Record<AssignmentStatus, string> = { assigned: "配置済み", confirmed: "確認済み", completed: "勤務完了", cancelled_by_worker: "スタッフ都合取消", cancelled_by_company: "会社都合取消", absent: "欠勤", no_show: "無断欠勤" };
export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <span className="inline-flex rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{labels[status]}</span>;
}
