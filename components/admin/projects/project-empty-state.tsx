import Link from "next/link";
import { AdminEmptyState, adminStateActionClass } from "@/components/admin/admin-state";
export function ProjectEmptyState({ filtered }: { filtered: boolean }) {
  return <AdminEmptyState title={filtered ? "条件に一致する案件がありません。" : "まだ案件が登録されていません。"} description={filtered ? "検索条件や絞り込み条件を変更してください。" : "新しい案件を作成して業務・勤務先を設定してください。"}><Link href={filtered ? "/admin/projects" : "/admin/projects/new"} className={adminStateActionClass}>{filtered ? "条件をクリア" : "案件を作成"}</Link></AdminEmptyState>;
}
