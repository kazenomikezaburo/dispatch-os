import { connection } from "next/server";
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
  if (!result.ok) return <AdminPage><AdminPageHeader title="案件詳細" /><div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">案件情報を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></AdminPage>;
  return <AdminPage><ProjectDetailHeader project={result.detail} formOptions={projectFormOptions.ok ? projectFormOptions.options : undefined} /><ProjectDetailSummary project={result.detail} /><ProjectOverview project={result.detail} /><ProjectJobList project={{ id: result.detail.id, name: result.detail.name, status: result.detail.status }} jobs={result.detail.jobs} formOptions={formOptions.ok ? formOptions.options : undefined} /><ProjectShiftSection jobs={result.detail.jobs} /></AdminPage>;
}
