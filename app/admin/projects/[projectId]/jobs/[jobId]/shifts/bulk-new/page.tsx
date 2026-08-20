import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { BulkShiftCreateForm } from "@/components/admin/projects/shifts/form/bulk-shift-create-form";
import { getShiftFormOptions } from "@/lib/admin/projects/get-shift-form-options";

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export default async function BulkNewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new">) {
  await connection();
  const values = await params;
  const projectId = idSchema.safeParse(values.projectId);
  const jobId = idSchema.safeParse(values.jobId);
  if (!projectId.success || !jobId.success) notFound();

  const result = await getShiftFormOptions(projectId.data, jobId.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) {
    return <section><h1 className="text-2xl font-semibold text-slate-950">複数日のシフトを追加</h1><div role="alert" className="mt-6 rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></section>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AdminBreadcrumb items={[{ label: "案件管理" }, { label: result.options.project.name }, { label: result.options.job.name }, { label: "複数日まとめて追加" }]} />
      <header><h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">複数日のシフトを追加</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">勤務日を選び、全日共通の勤務条件を入力してください。</p></header>
      <BulkShiftCreateForm options={result.options} />
    </div>
  );
}
