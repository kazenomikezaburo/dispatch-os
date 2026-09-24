import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState,AdminForbiddenState } from "@/components/admin/admin-state";
import { CredentialMasterWorkspace } from "@/components/admin/staff-credentials/credential-master-workspace";
import { getStaffCredentialMasters } from "@/lib/admin/staff-credentials/get-staff-credential-masters";

export default async function StaffCredentialsPage(){const result=await getStaffCredentialMasters();if(!result.ok)return result.reason==="forbidden"?<AdminForbiddenState message="スキル・資格マスタはSystem Adminのみ管理できます。"/>:<AdminErrorState title="スキル・資格マスタを取得できませんでした。"/>;return <AdminPage><AdminPageHeader title="スキル・資格マスタ" description="Staffの能力と資格を管理します。スキルに期限はなく、資格は有効期限・失効を扱います。"/><section aria-label="スキル・資格マスタ集計" className="grid gap-3 sm:grid-cols-2"><Metric label="スキル" value={result.data.skills.filter(x=>x.isActive).length} total={result.data.skills.length}/><Metric label="資格" value={result.data.qualifications.filter(x=>x.isActive).length} total={result.data.qualifications.length}/></section><CredentialMasterWorkspace skills={result.data.skills} qualifications={result.data.qualifications}/></AdminPage>}
function Metric({label,value,total}:{label:string;value:number;total:number}){return <div className="rounded-panel border border-border bg-surface p-4"><p className="text-sm text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{value}<span className="ml-2 text-sm font-normal text-foreground-muted">有効 / 全{total}件</span></p></div>}
