import Link from "next/link";
import { SHIFT_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import { SHIFT_STATUSES } from "@/lib/admin/projects/shift-form-schema";
import type { ShiftQuery } from "@/lib/admin/shifts/shift-list-types";

const PERIODS = { today: "今日", tomorrow: "明日", this_week: "今週", this_month: "今月", upcoming: "今後", past: "過去", all: "すべて" } as const;
const STAFFING = { all: "すべて", unassigned: "未配置", shortage: "不足あり", filled: "配置完了" } as const;
const control = "mt-1.5 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function ShiftFilters({ query }: { query: ShiftQuery }) {
  return <form method="get" className="rounded-lg border border-slate-200 bg-white p-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_repeat(3,minmax(9rem,1fr))]">
    <label className="text-sm font-medium text-slate-700">検索<input name="q" type="search" defaultValue={query.q} maxLength={100} placeholder="案件・業務・勤務先" className={control} /></label>
    <label className="text-sm font-medium text-slate-700">期間<select name="period" defaultValue={query.period} className={control}>{Object.entries(PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm font-medium text-slate-700">シフト状態<select name="status" defaultValue={query.status} className={control}><option value="all">すべて</option>{SHIFT_STATUSES.map((status) => <option key={status} value={status}>{SHIFT_STATUS_LABELS[status]}</option>)}</select></label>
    <label className="text-sm font-medium text-slate-700">人員状態<select name="staffing" defaultValue={query.staffing} className={control}>{Object.entries(STAFFING).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  </div><div className="mt-4 flex flex-wrap justify-end gap-3"><Link href="/admin/shifts" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">条件をリセット</Link><button type="submit" className="min-h-10 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">検索</button></div></form>;
}
