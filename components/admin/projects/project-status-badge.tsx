import { PROJECT_STATUS_LABELS } from "@/lib/admin/projects/project-rules";
import type { ProjectStatus } from "@/lib/admin/projects/project-types";
import { cn } from "@/lib/utils/cn";

const statusStyles: Record<ProjectStatus, { badge: string; dot: string }> = {
  draft: { badge: "bg-surface-muted text-foreground-secondary", dot: "bg-foreground-muted" },
  recruiting: { badge: "bg-info-subtle text-info-foreground", dot: "bg-info" },
  closed: { badge: "bg-warning-subtle text-warning-foreground", dot: "bg-warning" },
  in_progress: { badge: "bg-success-subtle text-success-foreground", dot: "bg-success" },
  completed: { badge: "bg-surface-muted text-foreground-secondary", dot: "bg-foreground-muted" },
  cancelled: { badge: "bg-danger-subtle text-danger-foreground", dot: "bg-danger" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const styles = statusStyles[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-1 text-xs font-medium", styles.badge)}><span aria-hidden="true" className={cn("size-1.5 rounded-full", styles.dot)} />{PROJECT_STATUS_LABELS[status]}</span>;
}
