import Link from "next/link";
import { connection } from "next/server";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { ProjectCreateForm } from "@/components/admin/projects/form/project-create-form";
import { getProjectFormOptions } from "@/lib/admin/projects/get-project-form-options";

export default async function NewProjectPage() {
  await connection();
  const result = await getProjectFormOptions();
  return <div className="mx-auto max-w-3xl space-y-6"><AdminBreadcrumb items={[{ label: "案件管理" }, { label: "新規案件" }]} /><header><h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">新規案件を作成</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">案件の基本情報を入力してください。</p></header>{result.ok ? <ProjectCreateForm options={result.options} /> : <div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="font-semibold text-slate-950">入力項目を取得できませんでした。</p><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p><Link href="/admin/projects" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-blue-700 hover:underline">案件一覧へ戻る</Link></div>}</div>;
}
