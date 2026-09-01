import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { JobForm } from "@/components/admin/projects/jobs/form/job-create-form";
import { getJobFormOptions } from "@/lib/admin/projects/get-job-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function NewJobPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/new">) {
  await connection();
  const id = uuidSchema.safeParse((await params).projectId);
  if (!id.success) notFound();
  const result = await getJobFormOptions(id.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <AdminPage width="form"><AdminPageHeader title="業務・勤務先を追加" /><div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></AdminPage>;
  return <AdminPage width="form"><AdminBreadcrumb items={[{ label: "案件管理" }, { label: result.options.project.name }, { label: "業務・勤務先を追加" }]} /><AdminPageHeader title="業務・勤務先を追加" description="募集する仕事内容と勤務条件を入力してください。" /><JobForm options={result.options} cancelHref={`/admin/projects/${result.options.project.id}`} /></AdminPage>;
}
