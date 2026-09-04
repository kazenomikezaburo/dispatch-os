import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/admin-state";

export default function SettingsPage() {
  return <AdminPage><AdminPageHeader title="設定" description="管理画面の設定を確認します。" /><AdminEmptyState title="設定は準備中です" description="設定の永続化Domainを定義するまでは変更できません。" /></AdminPage>;
}
