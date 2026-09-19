import { PROJECT_STATUS_LABELS } from "@/lib/admin/projects/project-rules";
import type { ProjectStatus } from "@/lib/admin/projects/project-types";
import { AdminStatusBadge, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

const statusTone: Record<ProjectStatus, AdminVisualTone> = {
  draft: "neutral", recruiting: "info", closed: "warning", in_progress: "success", completed: "neutral", cancelled: "danger",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <AdminStatusBadge tone={statusTone[status]} dot>{PROJECT_STATUS_LABELS[status]}</AdminStatusBadge>;
}
