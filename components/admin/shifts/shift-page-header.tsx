import { AdminPageHeader } from "@/components/admin/admin-page-header";
import Link from "next/link";
import { Plus } from "lucide-react";

export function ShiftPageHeader() {
  return <AdminPageHeader title="シフト一覧" description="日付・案件・勤務先からシフトを確認できます" actions={<div><Link href="/admin/projects" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Plus aria-hidden="true" className="size-4" />シフトを作成</Link><p className="mt-1.5 text-xs text-foreground-muted">案件・業務を選んで作成します</p></div>} />;
}
