import Link from "next/link";
import { connection } from "next/server";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectSetupForm } from "@/components/admin/projects/setup/project-setup-form";
import { getProjectFormOptions } from "@/lib/admin/projects/get-project-form-options";

export default async function NewProjectPage() {
  await connection();
  const result = await getProjectFormOptions();
  return <AdminPage width="form"><AdminBreadcrumb items={[{ label: "案件管理" }, { label: "新規案件" }]} /><AdminPageHeader title="新規案件セットアップ" description="案件、取引先、初期業務、勤務先を一つの画面で設定します。" />{result.ok ? <ProjectSetupForm options={result.options} initialWorkplaces={result.workplaces ?? []} /> : <div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p><Link href="/admin/projects" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-blue-700 hover:underline">案件一覧へ戻る</Link></div>}</AdminPage>;
}
