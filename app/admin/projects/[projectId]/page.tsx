import { connection } from "next/server";
import { AdminDetailWorkflowNav } from "@/components/admin/admin-detail-workflow-nav";
import { parseProjectDetailTab, projectDetailHref } from "@/components/admin/admin-detail-workflow-routes";
import { AdminErrorState } from "@/components/admin/admin-state";
import { notFound, redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { isEditorMode } from "@/components/admin/editor/admin-editor-contract";
import { ProjectDetailHeader } from "@/components/admin/projects/detail/project-detail-header";
import { ProjectDetailSummary } from "@/components/admin/projects/detail/project-detail-summary";
import { ProjectJobList } from "@/components/admin/projects/detail/project-job-list";
import { ProjectOverview } from "@/components/admin/projects/detail/project-overview";
import { ProjectHistory } from "@/components/admin/projects/detail/project-history";
import { ProjectShiftSection } from "@/components/admin/projects/detail/project-shift-section";
import { ProjectEditPageForm } from "@/components/admin/projects/form/project-edit-page-form";
import { ProjectWorkplaceWorkspace } from "@/components/admin/projects/detail/project-workplace-workspace";
import { getProjectDetail } from "@/lib/admin/projects/get-project-detail";
import { getProjectHistory } from "@/lib/admin/projects/get-project-history";
import { parseProjectHistoryCursor } from "@/lib/admin/projects/project-history-cursor";
import { getJobFormOptions } from "@/lib/admin/projects/get-job-form-options";
import { getProjectFormOptions } from "@/lib/admin/projects/get-project-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function ProjectDetailPage({ params, searchParams }: PageProps<"/admin/projects/[projectId]">) {
  await connection();
  const [route, query] = await Promise.all([params, searchParams]);
  const parsed = uuidSchema.safeParse(route.projectId);
  if (!parsed.success) notFound();
  const [result, formOptions, projectFormOptions] = await Promise.all([getProjectDetail(parsed.data), getJobFormOptions(parsed.data), getProjectFormOptions()]);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <AdminPage><AdminPageHeader title="案件詳細" /><AdminErrorState title="案件情報を取得できませんでした。" /></AdminPage>;
  const project = result.detail;
  if (isEditorMode(query.edit)) {
    if (!projectFormOptions.ok) return <AdminPage width="form"><AdminPageHeader title="案件を編集" /><AdminErrorState title="入力項目を取得できませんでした。" /></AdminPage>;
    return <AdminPage><AdminBreadcrumb items={[{ label: "案件", href: "/admin/projects" }, { label: project.name, href: `/admin/projects/${project.id}` }, { label: "編集" }]} /><AdminPageHeader title="案件を編集" description="案件の基本情報と、業務ごとの勤務先・会場を管理します。" /><div className="space-y-6"><ProjectEditPageForm project={project} options={projectFormOptions.options} />{formOptions.ok ? <ProjectWorkplaceWorkspace jobs={project.jobs} options={formOptions.options} /> : <AdminErrorState title="業務・勤務先・会場情報を取得できませんでした。" />}</div></AdminPage>;
  }
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (requestedTab === "jobs") redirect(projectDetailHref(project.id));
  const tab = parseProjectDetailTab(query.tab);
  const history = tab === "history" ? await getProjectHistory(project.id, parseProjectHistoryCursor(query.cursor)) : null;
  return <AdminPage>
    <ProjectDetailHeader project={project} />
    <AdminDetailWorkflowNav label="案件情報" items={[
      { label: "概要", href: projectDetailHref(project.id), current: tab === "overview" },
      { label: "シフト", href: projectDetailHref(project.id, "shifts"), current: tab === "shifts" },
      { label: "履歴", href: projectDetailHref(project.id, "history"), current: tab === "history" },
    ]} />
    {tab === "overview" && <><ProjectDetailSummary project={project} /><ProjectOverview project={project} /><div id="project-jobs" className="scroll-mt-24"><ProjectJobList project={{ id: project.id, name: project.name, status: project.status }} jobs={project.jobs} formOptions={formOptions.ok ? formOptions.options : undefined} /></div></>}
    {tab === "shifts" && <ProjectShiftSection jobs={project.jobs} />}
    {tab === "history" && (history?.ok ? <ProjectHistory projectId={project.id} page={history.page} /> : <AdminErrorState title="案件履歴を取得できませんでした。" />)}
  </AdminPage>;
}
