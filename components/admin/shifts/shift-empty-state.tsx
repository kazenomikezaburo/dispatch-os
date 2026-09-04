import Link from "next/link";
import { AdminEmptyState, adminStateActionClass } from "@/components/admin/admin-state";
export function ShiftEmptyState({ filtered }: { filtered: boolean }) {
  return <AdminEmptyState title={filtered ? "条件に一致するシフトがありません。" : "表示できるシフトがありません。"} description={filtered ? "検索条件を変更してください。" : "案件の業務からシフトを作成してください。"}><Link href={filtered ? "/admin/shifts" : "/admin/projects"} className={adminStateActionClass}>{filtered ? "条件をクリア" : "案件を選ぶ"}</Link></AdminEmptyState>;
}
