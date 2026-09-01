import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ShiftForm } from "@/components/admin/projects/shifts/form/shift-create-form";
import { getShiftFormOptions } from "@/lib/admin/projects/get-shift-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function NewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/new">) {
  await connection(); const values = await params; const projectId = uuidSchema.safeParse(values.projectId); const jobId = uuidSchema.safeParse(values.jobId); if (!projectId.success || !jobId.success) notFound();
  const result = await getShiftFormOptions(projectId.data, jobId.data); if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <AdminPage width="form"><AdminPageHeader title="シフトを追加" /><div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></AdminPage>;
  return <AdminPage width="form"><AdminBreadcrumb items={[{ label: "案件管理" }, { label: result.options.project.name }, { label: result.options.job.name }, { label: "シフトを追加" }]} /><AdminPageHeader title="シフトを追加" description="勤務日・時間・募集人数を入力してください。" /><ShiftForm options={result.options} cancelHref={`/admin/projects/${result.options.project.id}`} /></AdminPage>;
}
