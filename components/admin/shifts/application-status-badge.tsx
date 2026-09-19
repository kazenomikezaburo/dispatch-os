import type { ApplicationStatus } from "@/lib/admin/shifts/shift-detail-types";
import { AdminStatusBadge } from "@/components/admin/admin-visual-primitives";

const labels: Record<ApplicationStatus, string> = { applied: "応募中", accepted: "承認済み", rejected: "不採用", withdrawn: "辞退" };
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <AdminStatusBadge tone={status === "applied" ? "info" : status === "accepted" ? "success" : "neutral"}>{labels[status]}</AdminStatusBadge>;
}
