"use client";

import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";

export default function PlacementError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <AdminPage>
      <AdminPageHeader title="配置・休憩回し" />
      <AdminErrorState title="配置状況を表示できませんでした。"><button type="button" onClick={() => retry()} className={adminStateActionClass}>再試行</button></AdminErrorState>
    </AdminPage>
  );
}
