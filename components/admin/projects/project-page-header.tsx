import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export function ProjectPageHeader() {
  return (
    <AdminPageHeader
      title="案件一覧"
      description="募集中・進行中の案件と配置状況をまとめて管理します。"
      actions={<Link href="/admin/projects/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Plus aria-hidden="true" className="size-4" />新規案件</Link>}
    />
  );
}
