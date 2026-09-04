import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ShiftCreateEditor } from "@/components/admin/projects/shifts/form/shift-create-editor";
import { AdminErrorState } from "@/components/admin/admin-state";
import { getShiftFormOptions } from "@/lib/admin/projects/get-shift-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function NewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/new">) {
  await connection(); const values = await params; const projectId = uuidSchema.safeParse(values.projectId); const jobId = uuidSchema.safeParse(values.jobId); if (!projectId.success || !jobId.success) notFound();
  const result = await getShiftFormOptions(projectId.data, jobId.data); if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <AdminPage width="form-wide"><AdminPageHeader title="シフトを作成" /><AdminErrorState title="入力項目を取得できませんでした。" /></AdminPage>;
  const initialDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <AdminPage width="form-wide"><AdminBreadcrumb items={[{ label: "案件", href: "/admin/projects" }, { label: result.options.project.name, href: `/admin/projects/${result.options.project.id}` }, { label: result.options.job.name }, { label: "シフトを作成" }]} /><AdminPageHeader title="シフトを作成" description="1日だけでも、必要な日付を追加して複数日でも作成できます。" /><ShiftCreateEditor options={result.options} initialDate={initialDate} /></AdminPage>;
}
