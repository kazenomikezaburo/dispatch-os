type DashboardSummaryCardProps = {
  label: string;
  value: number;
  unit: "名" | "件";
  description: string;
  tone: "primary" | "success" | "attention";
};

const toneClassNames = {
  primary: {
    accent: "bg-blue-600",
    value: "text-info-foreground",
  },
  success: {
    accent: "bg-emerald-600",
    value: "text-success-foreground",
  },
  attention: {
    accent: "bg-amber-500",
    value: "text-warning-foreground",
  },
} as const;

export function DashboardSummaryCard({
  label,
  value,
  unit,
  description,
  tone,
}: DashboardSummaryCardProps) {
  const toneClasses = toneClassNames[tone];

  return (
    <article className="relative overflow-hidden rounded-ds-card border border-border bg-surface px-5 py-4 sm:min-h-28">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${toneClasses.accent}`}
      />
      <p className="text-xs font-medium text-foreground-muted">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${toneClasses.value}`}>
        {value}<span className="ml-1 text-base font-medium text-foreground-muted">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-foreground-muted">{description}</p>
    </article>
  );
}
