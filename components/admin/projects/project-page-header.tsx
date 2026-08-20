import Link from "next/link";
import { Plus } from "lucide-react";

export function ProjectPageHeader() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 id="page-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">案件管理</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">案件・募集状況・人員配置を管理します。</p></div>
      <Link href="/admin/projects/new" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Plus aria-hidden="true" className="size-4" />新規案件</Link>
    </header>
  );
}
