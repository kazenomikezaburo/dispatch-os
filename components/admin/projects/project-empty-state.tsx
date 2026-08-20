import { BriefcaseBusiness } from "lucide-react";

export function ProjectEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
      <BriefcaseBusiness aria-hidden="true" className="mx-auto size-8 text-slate-400" />
      <p className="mt-3 font-semibold text-slate-950">{filtered ? "条件に一致する案件がありません。" : "まだ案件が登録されていません。"}</p>
      {filtered && <p className="mt-1 text-sm text-slate-600">検索条件や絞り込み条件を変更してください。</p>}
    </div>
  );
}
