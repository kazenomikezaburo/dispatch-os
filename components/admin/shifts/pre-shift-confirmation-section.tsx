import type { PreShiftConfirmationSummary } from "@/lib/admin/shifts/pre-shift-confirmation-types";
import { AssignmentStatusBadge } from "./assignment-status-badge";
import { PreShiftConfirmationStatusBadge } from "./pre-shift-confirmation-status-badge";
import { Section } from "./shift-info-section";

const submittedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function PreShiftConfirmationSection({ summary }: { summary: PreShiftConfirmationSummary }) {
  return (
    <Section title="前日確認">
      {summary.items.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-600">前日確認の対象スタッフはいません。</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-slate-50 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-950">{summary.confirmedCount} / {summary.items.length}名 確認済み</p>
            {summary.unconfirmedCount > 0 && <p className="font-semibold text-amber-800">未確認 {summary.unconfirmedCount}名</p>}
            {summary.beforeOpenCount > 0 && <p className="text-slate-600">受付前 {summary.beforeOpenCount}名</p>}
          </div>
          <ul className="divide-y divide-slate-200">
            {summary.items.map((item) => (
              <li key={item.assignmentId} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{item.workerName}</p>
                  <div className="mt-2"><AssignmentStatusBadge status={item.assignmentStatus} /></div>
                </div>
                <div className="sm:text-right">
                  <PreShiftConfirmationStatusBadge state={item.state} />
                  <p className="mt-2 text-sm text-slate-600">{item.submittedAt ? `確認日時 ${submittedAt.format(new Date(item.submittedAt))}` : "確認日時 -"}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
