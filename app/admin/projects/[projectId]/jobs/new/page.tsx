import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { JobCreateForm } from "@/components/admin/projects/jobs/form/job-create-form";
import { getJobFormOptions } from "@/lib/admin/projects/get-job-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function NewJobPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/new">) {
  await connection();
  const id = uuidSchema.safeParse((await params).projectId);
  if (!id.success) notFound();
  const result = await getJobFormOptions(id.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <section><h1 className="text-2xl font-semibold text-slate-950">業務・勤務先を追加</h1><div role="alert" className="mt-6 rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></section>;
  return <div className="mx-auto max-w-3xl space-y-6"><AdminBreadcrumb items={[{ label: "案件管理" }, { label: result.options.project.name }, { label: "業務・勤務先を追加" }]} /><header><h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">業務・勤務先を追加</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">募集する仕事内容と勤務条件を入力してください。</p></header><JobCreateForm options={result.options} /></div>;
}
