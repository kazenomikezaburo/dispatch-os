import { addDaysToDate } from "@/lib/admin/projects/bulk-shift-form-schema";

type Props = {
  dates: string[];
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  requiredWorkers: string;
  breakMinutes: string;
  deadlineEnabled: boolean;
  deadlineDaysBefore: string;
  deadlineTime: string;
};

const displayDate = (date: string) => date.replace(/-/g, "/");

export function BulkShiftPreview(props: Props) {
  return (
    <section aria-labelledby="bulk-preview-title" className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h2 id="bulk-preview-title" className="font-semibold text-slate-950">
        作成予定：{props.dates.length}件
      </h2>
      {props.dates.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">勤務日を追加すると、作成予定のシフトを確認できます。</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="作成予定シフト">
          {props.dates.map((date) => {
            const deadlineDate = /^\d+$/.test(props.deadlineDaysBefore)
              ? addDaysToDate(date, -Number(props.deadlineDaysBefore))
              : null;
            return (
              <li key={date} className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">{displayDate(date)}</p>
                <p className="mt-1">{props.startTime || "--:--"}〜{props.endTime || "--:--"}{props.endsNextDay ? "（翌日）" : ""}</p>
                <p>必要 {props.requiredWorkers || "-"}名 / 休憩 {props.breakMinutes === "" ? "なし" : `${props.breakMinutes}分`}</p>
                <p>締切 {props.deadlineEnabled && deadlineDate && props.deadlineTime ? `${displayDate(deadlineDate)} ${props.deadlineTime}` : "設定なし"}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
