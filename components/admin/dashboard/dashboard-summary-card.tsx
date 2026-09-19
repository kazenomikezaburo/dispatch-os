import { AdminKpiCard } from "@/components/admin/admin-visual-primitives";

type DashboardSummaryCardProps = {
  label: string;
  value: number;
  unit: "名" | "件";
  description: string;
  tone: "primary" | "success" | "attention";
};

export function DashboardSummaryCard({
  label,
  value,
  unit,
  description,
  tone,
}: DashboardSummaryCardProps) {
  return <AdminKpiCard label={label} value={value} unit={unit} description={description} tone={tone === "primary" ? "info" : tone === "attention" ? "warning" : "success"} />;
}
