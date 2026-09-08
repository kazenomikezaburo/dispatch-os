import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminLoadingState } from "@/components/admin/admin-state";

export default function PlacementLoading() {
  return <AdminPage><AdminPageHeader title="配置・休憩回し" /><AdminLoadingState /></AdminPage>;
}
