import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";

export function ShiftDetailSummary({ detail }: { detail: AdminShiftDetail }) {
  const metrics = [["必要", detail.requiredWorkers], ["応募", detail.applicationCount], ["配置", detail.assignedWorkers], ["不足", detail.shortage]] as const;
  return <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="border-b border-r border-slate-200 p-4 last:border-r-0 sm:border-b-0"><dt className="text-sm text-slate-500">{label}</dt><dd className={`mt-1 text-2xl font-semibold ${label === "不足" && value > 0 ? "text-red-700" : "text-slate-950"}`}>{value}<span className="ml-1 text-sm font-normal text-slate-500">名</span></dd></div>)}</dl>;
}
