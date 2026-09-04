import type { AttendanceSummary as Summary } from "@/lib/admin/attendance/attendance-types";

export function AttendanceSummary({ summary }: { summary: Summary }) {
  const items = [
    ["勤務予定", summary.total, "text-foreground", "人"],
    ["未確定", summary.unconfirmed, "text-warning", "件"],
    ["確定", summary.confirmed, "text-success", "件"],
    ["訂正済み", summary.corrected, "text-info", "件"],
    ["欠勤・無断欠勤", summary.absent + summary.noShow, "text-danger", "件"],
  ] as const;
  return (
    <section aria-labelledby="attendance-summary-title">
      <h2 id="attendance-summary-title" className="sr-only">勤怠サマリー</h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {items.map(([label, value, tone, unit]) => (
          <div key={label} className="rounded-panel border border-border bg-surface p-4">
            <dt className="text-sm font-medium text-foreground-muted">{label}</dt>
            <dd className={`mt-2 text-2xl font-semibold ${tone}`}>{value}<span className="ml-1 text-sm font-normal text-foreground-muted">{unit}</span></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
