import { connection } from "next/server";
import { AdminPage } from "@/components/admin/admin-page";
import { ProjectEmptyState } from "@/components/admin/projects/project-empty-state";
import { ProjectFilters } from "@/components/admin/projects/project-filters";
import { ProjectList } from "@/components/admin/projects/project-list";
import { ProjectPageHeader } from "@/components/admin/projects/project-page-header";
import { ProjectSummary } from "@/components/admin/projects/project-summary";
import { getProjects } from "@/lib/admin/projects/get-projects";
import { parseProjectQuery } from "@/lib/admin/projects/project-query-schema";

export default async function ProjectsPage({ searchParams }: PageProps<"/admin/projects">) {
  await connection();
  const filters = parseProjectQuery(await searchParams);
  const result = await getProjects(filters);

  return (
    <AdminPage>
      <ProjectPageHeader />
      {result.ok && <ProjectSummary projects={result.projects} />}
      <ProjectFilters filters={filters} />
      {!result.ok ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-white p-5">
          <p className="font-semibold text-slate-950">案件一覧を取得できませんでした。</p>
          <p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p>
        </div>
      ) : result.projects.length === 0 ? (
        <ProjectEmptyState filtered={Boolean(filters.q || filters.status !== "all" || filters.period !== "all")} />
      ) : (
        <ProjectList projects={result.projects} />
      )}
    </AdminPage>
  );
}
