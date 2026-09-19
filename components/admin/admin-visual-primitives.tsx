import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type AdminVisualTone = "neutral" | "info" | "success" | "warning" | "danger";

const valueTone: Record<AdminVisualTone, string> = {
  neutral: "text-foreground",
  info: "text-info-foreground",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
};

const badgeTone: Record<AdminVisualTone, string> = {
  neutral: "bg-surface-muted text-foreground-secondary",
  info: "bg-info-subtle text-info-foreground",
  success: "bg-success-subtle text-success-foreground",
  warning: "bg-warning-subtle text-warning-foreground",
  danger: "bg-danger-subtle text-danger-foreground",
};

export function AdminKpiCard({ label, value, unit, description, tone = "neutral" }: { label: string; value: ReactNode; unit?: string; description?: string; tone?: AdminVisualTone }) {
  return <article className="rounded-card border border-border bg-surface px-4 py-4 sm:px-5">
    <p className="text-xs font-medium text-foreground-muted">{label}</p>
    <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", valueTone[tone])}>{value}{unit && <span className="ml-1 text-sm font-normal text-foreground-muted">{unit}</span>}</p>
    {description && <p className="mt-1 text-xs text-foreground-muted">{description}</p>}
  </article>;
}

export function AdminStatusBadge({ children, tone = "neutral", icon, dot = false, className }: { children: ReactNode; tone?: AdminVisualTone; icon?: ReactNode; dot?: boolean; className?: string }) {
  return <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold", badgeTone[tone], className)}>
    {icon}
    {dot && <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone === "info" ? "bg-info" : tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-danger" : "bg-foreground-muted")} />}
    {children}
  </span>;
}
