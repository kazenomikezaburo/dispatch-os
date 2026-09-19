import Link from "next/link";
import { singleShiftConfirmationHref, type SingleShiftConfirmationPhase } from "@/lib/admin/shifts/single-shift-confirmation-rules";

export function ConfirmationPhaseNav({ shiftId, phase }: { shiftId: string; phase: SingleShiftConfirmationPhase }) {
  return <nav aria-label="確認フェーズ" className="inline-flex min-h-11 max-w-full rounded-control border border-border bg-surface-subtle p-1">
    {([["pre", "前日確認"], ["day", "当日確認"]] as const).map(([value, label]) => <Link key={value} href={singleShiftConfirmationHref(shiftId, value)} aria-current={phase === value ? "page" : undefined} className={`inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm focus-visible:outline-2 focus-visible:outline-focus-ring ${phase === value ? "bg-surface font-semibold text-foreground shadow-sm" : "font-medium text-foreground-secondary hover:bg-surface-hover"}`}>{label}</Link>)}
  </nav>;
}
