import { PROJECT_STATUS_LABELS } from "@/lib/admin/projects/project-rules";
import type { ProjectStatus } from "@/lib/admin/projects/project-types";
import { cn } from "@/lib/utils/cn";

const statusStyles: Record<ProjectStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  recruiting: "bg-blue-50 text-blue-800",
  closed: "bg-amber-50 text-amber-800",
  in_progress: "bg-emerald-50 text-emerald-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-50 text-red-800",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={cn("inline-flex rounded px-2.5 py-1 text-xs font-semibold", statusStyles[status])}>{PROJECT_STATUS_LABELS[status]}</span>;
}
