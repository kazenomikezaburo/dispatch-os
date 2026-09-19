import type { StaffingState } from "@/lib/admin/shifts/shift-list-types";
import { AdminStatusBadge } from "@/components/admin/admin-visual-primitives";

export function StaffingStatusBadge({ staffingState, shortage }: { staffingState: StaffingState; shortage: number }) {
  if (staffingState === "unassigned") return <AdminStatusBadge tone="danger">未配置</AdminStatusBadge>;
  if (staffingState === "shortage") return <AdminStatusBadge tone="warning">{shortage}名不足</AdminStatusBadge>;
  return <AdminStatusBadge tone="success">配置完了</AdminStatusBadge>;
}
