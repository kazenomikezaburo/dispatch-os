import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export function ProjectPageHeader() {
  return (
    <AdminPageHeader
      title="案件一覧"
      description="案件を探し、取引先・期間・業務・シフトの状況をまとめて管理します。"
      actions={<Link href="/admin/projects/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Plus aria-hidden="true" className="size-4" />新規案件</Link>}
    />
  );
}
