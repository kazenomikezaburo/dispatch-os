import { connection } from "next/server";
import Link from "next/link";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectDetailHeader } from "@/components/admin/projects/detail/project-detail-header";
import { ProjectDetailSummary } from "@/components/admin/projects/detail/project-detail-summary";
import { ProjectJobList } from "@/components/admin/projects/detail/project-job-list";
import { ProjectOverview } from "@/components/admin/projects/detail/project-overview";
import { ProjectShiftSection } from "@/components/admin/projects/detail/project-shift-section";
import { getProjectDetail } from "@/lib/admin/projects/get-project-detail";
import { getJobFormOptions } from "@/lib/admin/projects/get-job-form-options";
import { getProjectFormOptions } from "@/lib/admin/projects/get-project-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function ProjectDetailPage({ params }: PageProps<"/admin/projects/[projectId]">) {
  await connection();
  const parsed = uuidSchema.safeParse((await params).projectId);
  if (!parsed.success) notFound();
  const [result, formOptions, projectFormOptions] = await Promise.all([getProjectDetail(parsed.data), getJobFormOptions(parsed.data), getProjectFormOptions()]);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <AdminPage><AdminPageHeader title="案件詳細" /><AdminErrorState title="案件情報を取得できませんでした。" /></AdminPage>;
  const project = result.detail;
  return <AdminPage>
    <ProjectDetailHeader project={project} formOptions={projectFormOptions.ok ? projectFormOptions.options : undefined} />
    <AdminSectionNav label="案件内のセクション" items={[{ label: "概要", href: "#project-overview" }, { label: "業務・勤務先", href: "#project-jobs" }, { label: "シフト", href: "#project-shifts" }, { label: "運用", href: "#project-operations" }]} />
    <ProjectDetailSummary project={project} />
    <div id="project-overview" className="scroll-mt-24"><ProjectOverview project={project} /></div>
    <div id="project-jobs" className="scroll-mt-24"><ProjectJobList project={{ id: project.id, name: project.name, status: project.status }} jobs={project.jobs} formOptions={formOptions.ok ? formOptions.options : undefined} /></div>
    <div id="project-shifts" className="scroll-mt-24"><ProjectShiftSection jobs={project.jobs} /></div>
    <section id="project-operations" className="scroll-mt-24 rounded-panel border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">案件の運用</h2>
      <p className="mt-2 text-sm text-foreground-secondary">応募・配置・事前確認は、各シフトの詳細で操作できます。</p>
      <div className="mt-4 flex flex-wrap gap-3"><a href="#project-shifts" className={adminStateActionClass}>案件内のシフトを確認</a><Link href={`/admin/shifts?q=${encodeURIComponent(project.name)}`} className={adminStateActionClass}>シフト一覧で検索</Link></div>
    </section>
  </AdminPage>;
}
