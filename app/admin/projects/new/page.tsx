import Link from "next/link";
import { connection } from "next/server";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectForm } from "@/components/admin/projects/form/project-create-form";
import { getProjectFormOptions } from "@/lib/admin/projects/get-project-form-options";

export default async function NewProjectPage() {
  await connection();
  const result = await getProjectFormOptions();
  return <AdminPage width="form"><AdminBreadcrumb items={[{ label: "案件管理" }, { label: "新規案件" }]} /><AdminPageHeader title="新規案件を作成" description="案件の基本情報を入力してください。" />{result.ok ? <ProjectForm options={result.options} cancelHref="/admin/projects" /> : <div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p><Link href="/admin/projects" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-blue-700 hover:underline">案件一覧へ戻る</Link></div>}</AdminPage>;
}
