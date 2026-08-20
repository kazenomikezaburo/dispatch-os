import type { ShiftListItem } from "@/lib/admin/shifts/shift-list-types";

export function StaffingStatusBadge({ shift }: { shift: ShiftListItem }) {
  if (shift.staffingState === "unassigned") return <span className="inline-flex rounded bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">未配置</span>;
  if (shift.staffingState === "shortage") return <span className="inline-flex rounded bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{shift.shortage}名不足</span>;
  return <span className="inline-flex rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">配置完了</span>;
}
