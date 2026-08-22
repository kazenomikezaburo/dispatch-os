import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { ShiftCreateForm } from "@/components/admin/projects/shifts/form/shift-create-form";
import { getShiftFormOptions } from "@/lib/admin/projects/get-shift-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function NewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/new">) {
  await connection(); const values = await params; const projectId = uuidSchema.safeParse(values.projectId); const jobId = uuidSchema.safeParse(values.jobId); if (!projectId.success || !jobId.success) notFound();
  const result = await getShiftFormOptions(projectId.data, jobId.data); if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <section><h1 className="text-2xl font-semibold text-slate-950">シフトを追加</h1><div role="alert" className="mt-6 rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></section>;
  return <div className="mx-auto max-w-3xl space-y-6"><AdminBreadcrumb items={[{ label: "案件管理" }, { label: result.options.project.name }, { label: result.options.job.name }, { label: "シフトを追加" }]} /><header><h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">シフトを追加</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">勤務日・時間・募集人数を入力してください。</p></header><ShiftCreateForm options={result.options} /></div>;
}
