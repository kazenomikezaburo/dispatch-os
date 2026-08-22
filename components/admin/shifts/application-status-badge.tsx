import type { ApplicationStatus } from "@/lib/admin/shifts/shift-detail-types";

const labels: Record<ApplicationStatus, string> = { applied: "応募中", accepted: "承認済み", rejected: "不採用", withdrawn: "辞退" };
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const style = status === "applied" ? "bg-blue-50 text-blue-800" : status === "accepted" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${style}`}>{labels[status]}</span>;
}
