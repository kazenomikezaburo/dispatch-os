import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";

export function ProjectDetailSummary({ project }: { project: ProjectDetail }) {
  const s = project.summary; const width = Math.min(Math.max(s.progress, 0), 100);
  const items = [
    { label: "必要人数", value: `${s.requiredWorkers}名`, tone: "border-slate-300 text-slate-950" },
    { label: "配置済み", value: `${s.assignedWorkers}名`, tone: "border-emerald-500 text-emerald-700" },
    { label: "不足", value: `${s.shortage}名`, tone: s.shortage > 0 ? "border-red-500 text-red-700" : "border-emerald-500 text-emerald-700" },
    { label: "業務・勤務先", value: `${s.jobCount}件`, tone: "border-blue-600 text-blue-700" },
    { label: "シフト", value: `${s.shiftCount}件`, tone: "border-blue-600 text-blue-700" },
  ];
  return <section aria-labelledby="summary-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="summary-title" className="text-lg font-semibold text-slate-950">配置サマリー</h2><p className="mt-1 text-sm text-slate-600">案件全体の業務・シフトと人員配置です。</p></div>
      <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${s.shortage > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>{s.shortage > 0 ? `要確認・${s.shortage}名不足` : "配置充足"}</span>
    </div>
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{items.map((item) => <div key={item.label} className={`rounded-lg border border-l-4 bg-white p-4 ${item.tone}`}><dt className="text-xs font-semibold text-slate-500">{item.label}</dt><dd className="mt-2 text-xl font-semibold sm:text-2xl">{item.value}</dd></div>)}</dl>
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-3 text-sm"><span className="font-medium text-slate-800">配置率</span><span className="font-semibold text-slate-950">{s.assignedWorkers} / {s.requiredWorkers}名（{s.progress}%）</span></div><div role="progressbar" aria-label={`${project.name}の配置率`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${s.shortage > 0 ? "bg-amber-500" : "bg-blue-700"}`} style={{ width: `${width}%` }} /></div></div>
  </section>;
}
