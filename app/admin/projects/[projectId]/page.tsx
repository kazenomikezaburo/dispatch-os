import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ProjectDetailHeader } from "@/components/admin/projects/detail/project-detail-header";
import { ProjectDetailSummary } from "@/components/admin/projects/detail/project-detail-summary";
import { ProjectJobList } from "@/components/admin/projects/detail/project-job-list";
import { ProjectOverview } from "@/components/admin/projects/detail/project-overview";
import { getProjectDetail } from "@/lib/admin/projects/get-project-detail";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function ProjectDetailPage({ params }: PageProps<"/admin/projects/[projectId]">) {
  await connection();
  const parsed = uuidSchema.safeParse((await params).projectId);
  if (!parsed.success) notFound();
  const result = await getProjectDetail(parsed.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <section aria-labelledby="page-title"><h1 id="page-title" className="text-2xl font-semibold text-slate-950">案件詳細</h1><div role="alert" className="mt-6 rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">案件情報を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></section>;
  return <div className="space-y-6 lg:space-y-8"><ProjectDetailHeader project={result.detail} /><ProjectDetailSummary project={result.detail} /><ProjectOverview project={result.detail} /><ProjectJobList projectId={result.detail.id} jobs={result.detail.jobs} /></div>;
}
