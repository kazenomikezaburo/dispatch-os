import type { ProjectListItem as ProjectListItemType } from "@/lib/admin/projects/project-types";
import { ProjectListItem } from "./project-list-item";

export function ProjectList({ projects }: { projects: ProjectListItemType[] }) {
  return <ul aria-label="案件一覧" className="space-y-3">{projects.map((project) => <ProjectListItem key={project.id} project={project} />)}</ul>;
}
