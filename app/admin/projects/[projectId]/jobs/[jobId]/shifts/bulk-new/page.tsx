import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BulkShiftCreateForm } from "@/components/admin/projects/shifts/form/bulk-shift-create-form";
import { getShiftFormOptions } from "@/lib/admin/projects/get-shift-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function BulkNewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new">) {
  await connection();
  const values = await params;
  const projectId = uuidSchema.safeParse(values.projectId);
  const jobId = uuidSchema.safeParse(values.jobId);
  if (!projectId.success || !jobId.success) notFound();

  const result = await getShiftFormOptions(projectId.data, jobId.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) {
    return <AdminPage width="form-wide"><AdminPageHeader title="シフトを一括作成" /><div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></div></AdminPage>;
  }

  return (
    <AdminPage width="form-wide">
      <AdminBreadcrumb items={[{ label: "案件" }, { label: result.options.project.name }, { label: result.options.job.name }, { label: "シフト一括作成" }]} />
      <AdminPageHeader title="シフトを一括作成" description="共通設定をもとに複数日のシフトを作成します。" />
      <BulkShiftCreateForm options={result.options} />
    </AdminPage>
  );
}
