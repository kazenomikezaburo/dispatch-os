import type { ShiftListItem as ShiftItem } from "@/lib/admin/shifts/shift-list-types";
import { ShiftListItem } from "./shift-list-item";

export function ShiftList({ shifts }: { shifts: ShiftItem[] }) {
  return <section aria-labelledby="shift-results-title" className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5"><h2 id="shift-results-title" className="font-semibold text-slate-950">シフト一覧</h2><p className="text-sm text-slate-600">{shifts.length}件</p></div><div aria-hidden="true" className="hidden grid-cols-[5rem_5.5rem_minmax(0,1.5fr)_minmax(0,1fr)_repeat(4,2.5rem)_6rem] gap-3 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600 xl:grid"><span>日付</span><span>時間</span><span>案件 / 業務</span><span>勤務先</span><span>必要</span><span>応募</span><span>配置</span><span>不足</span><span className="text-right">状態</span></div><ul>{shifts.map((shift) => <ShiftListItem key={shift.id} shift={shift} />)}</ul></section>;
}
