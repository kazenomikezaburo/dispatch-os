import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";

const dateTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
export function ShiftInfoSection({ detail }: { detail: AdminShiftDetail }) {
  return <Section title="勤務情報"><dl className="grid gap-5 sm:grid-cols-3"><Item label="勤務日時">{dateTime.format(new Date(detail.startsAt))}〜<br />{dateTime.format(new Date(detail.endsAt))}</Item><Item label="休憩">{detail.breakMinutes === null ? "未設定" : `${detail.breakMinutes}分`}</Item><Item label="応募締切">{detail.applicationDeadline ? dateTime.format(new Date(detail.applicationDeadline)) : "未設定"}</Item></dl></Section>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><div className="mt-4">{children}</div></section>; }
export function Item({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{children}</dd></div>; }
