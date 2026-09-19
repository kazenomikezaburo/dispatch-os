import type { PreShiftConfirmationState } from "@/lib/admin/shifts/pre-shift-confirmation-types";
import { AdminStatusBadge, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

const values: Record<PreShiftConfirmationState, { label: string; tone: AdminVisualTone }> = {
  not_open: { label: "受付前", tone: "neutral" }, pending: { label: "未確認", tone: "warning" }, confirmed: { label: "確認済み", tone: "success" },
};

export function PreShiftConfirmationStatusBadge({ state }: { state: PreShiftConfirmationState }) {
  const value = values[state];
  return <AdminStatusBadge tone={value.tone}>{value.label}</AdminStatusBadge>;
}
