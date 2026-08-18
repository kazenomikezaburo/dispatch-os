type DashboardSummaryCardProps = {
  label: string;
  value: number;
  unit: "名" | "件";
  tone?: "default" | "attention";
};

export function DashboardSummaryCard({ label, value, unit, tone = "default" }: DashboardSummaryCardProps) {
  return (
    <article className={`rounded-lg border bg-white p-5 ${tone === "attention" && value > 0 ? "border-amber-300" : "border-slate-200"}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}<span className="ml-1 text-base font-medium text-slate-500">{unit}</span>
      </p>
    </article>
  );
}
