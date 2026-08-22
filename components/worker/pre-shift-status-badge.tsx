import type { PreShiftConfirmationState } from "@/lib/domain/pre-shift-confirmation";

const values: Record<PreShiftConfirmationState, { label: string; className: string }> = {
  not_open: { label: "受付前", className: "bg-slate-100 text-slate-700" },
  pending: { label: "未確認", className: "bg-amber-50 text-amber-800" },
  confirmed: { label: "確認済み", className: "bg-emerald-50 text-emerald-800" },
};

export function PreShiftStatusBadge({ state }: { state: PreShiftConfirmationState }) {
  const value = values[state];
  return <span className={`inline-flex rounded px-2.5 py-1 text-sm font-semibold ${value.className}`}>{value.label}</span>;
}
