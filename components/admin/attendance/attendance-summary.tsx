import type { AttendanceSummary as Summary } from "@/lib/admin/attendance/attendance-types";
import { AdminKpiCard, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

export function AttendanceSummary({ summary }: { summary: Summary }) {
  const items = [
    ["勤務予定", summary.total, "neutral", "人"],
    ["未確定", summary.unconfirmed, "warning", "件"],
    ["確定", summary.confirmed, "success", "件"],
    ["訂正済み", summary.corrected, "info", "件"],
    ["欠勤・無断欠勤", summary.absent + summary.noShow, "danger", "件"],
  ] as const;
  return (
    <section aria-labelledby="attendance-summary-title">
      <h2 id="attendance-summary-title" className="sr-only">勤怠サマリー</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {items.map(([label, value, tone, unit]) => <AdminKpiCard key={label} label={label} value={value} unit={unit} tone={tone as AdminVisualTone} />)}
      </div>
    </section>
  );
}
