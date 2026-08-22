import type { StaffingState } from "@/lib/admin/shifts/shift-list-types";

export function StaffingStatusBadge({ staffingState, shortage }: { staffingState: StaffingState; shortage: number }) {
  if (staffingState === "unassigned") return <span className="inline-flex rounded bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">未配置</span>;
  if (staffingState === "shortage") return <span className="inline-flex rounded bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{shortage}名不足</span>;
  return <span className="inline-flex rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">配置完了</span>;
}
