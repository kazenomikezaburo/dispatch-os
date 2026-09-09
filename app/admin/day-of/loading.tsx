import {AdminPage} from "@/components/admin/admin-page";
import {AdminPageHeader} from "@/components/admin/admin-page-header";
import {AdminLoadingState} from "@/components/admin/admin-state";
export default function Loading(){return <AdminPage><AdminPageHeader title="当日運用"/><AdminLoadingState/></AdminPage>}
