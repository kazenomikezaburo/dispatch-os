import { AdminLoadingState } from "@/components/admin/admin-state";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function Loading(){return <AdminPage><AdminPageHeader title="要対応" description="判断や対応が必要な業務状態を読み込んでいます。"/><AdminLoadingState/></AdminPage>;}

