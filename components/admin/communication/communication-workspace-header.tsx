import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";

const communicationTabs = [
  { label: "ヘルプリクエスト", href: "/admin/incidents" },
  { label: "お知らせ", href: "/admin/announcements" },
] as const;

export function CommunicationWorkspaceHeader() {
  return (
    <div className="space-y-5">
      <AdminPageHeader title="連絡" description="現場からの問い合わせと管理者からのお知らせを管理します。" />
      <AdminSectionTabs label="連絡の種類" items={communicationTabs} />
    </div>
  );
}
