import type { ProjectListItem as ProjectListItemType } from "@/lib/admin/projects/project-types";
import { ProjectListItem } from "./project-list-item";

export function ProjectList({ projects }: { projects: ProjectListItemType[] }) {
  return (
    <section aria-labelledby="project-list-title" className="overflow-hidden rounded-panel border border-border bg-surface">
      <h2 id="project-list-title" className="sr-only">案件一覧</h2>
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_3rem_6rem_minmax(0,1fr)_5rem] gap-4 border-b border-border bg-surface-subtle px-5 py-3 text-xs font-semibold text-foreground-muted lg:grid">
        <span>案件 / 取引先</span>
        <span>期間</span>
        <span>シフト</span>
        <span>必要 / 配置</span>
        <span>充足率</span>
        <span>状態</span>
      </div>
      <ul aria-label="案件一覧" className="divide-y divide-border">
        {projects.map((project) => <ProjectListItem key={project.id} project={project} />)}
      </ul>
      <p className="border-t border-border px-5 py-3 text-xs text-foreground-muted">全 {projects.length}件</p>
    </section>
  );
}
