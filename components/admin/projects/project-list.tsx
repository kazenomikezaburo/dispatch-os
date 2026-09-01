import type { ProjectListItem as ProjectListItemType } from "@/lib/admin/projects/project-types";
import { ProjectListItem } from "./project-list-item";

export function ProjectList({ projects }: { projects: ProjectListItemType[] }) {
  return (
    <section aria-labelledby="project-list-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h2 id="project-list-title" className="sr-only">案件一覧</h2>
      <div aria-hidden="true" className="hidden grid-cols-[minmax(12rem,1.5fr)_10rem_5rem_9rem_minmax(10rem,1fr)_7rem] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500 lg:grid">
        <span>案件 / 取引先</span>
        <span>期間</span>
        <span>シフト</span>
        <span>必要 / 配置</span>
        <span>充足率</span>
        <span>状態</span>
      </div>
      <ul aria-label="案件一覧" className="divide-y divide-slate-200">
        {projects.map((project) => <ProjectListItem key={project.id} project={project} />)}
      </ul>
      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">全 {projects.length}件</p>
    </section>
  );
}
