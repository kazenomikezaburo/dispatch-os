export function ShiftEmptyState({ filtered }: { filtered: boolean }) {
  return <section className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center"><h2 className="font-semibold text-slate-950">{filtered ? "条件に一致するシフトがありません。" : "表示できるシフトがありません。"}</h2>{filtered && <p className="mt-2 text-sm text-slate-600">検索条件を変更してみてください。</p>}</section>;
}
