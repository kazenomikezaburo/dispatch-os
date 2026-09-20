import { connection } from "next/server";
import { AttentionQueue } from "@/components/admin/attention/attention-queue";
import { AttentionSummary } from "@/components/admin/attention/attention-summary";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState, AdminErrorState } from "@/components/admin/admin-state";
import { getAdminAttention } from "@/lib/admin/attention/get-admin-attention";

export default async function AttentionPage(){
  await connection();
  const result=await getAdminAttention();
  return <AdminPage><AdminPageHeader title="要対応" description="判断や対応が必要な業務状態を、優先度順に確認します。" actions={result.ok?<span aria-label={`未対応 ${result.data.summary.total}件`} className="inline-flex min-h-8 items-center rounded-ds-pill bg-danger-subtle px-4 text-sm font-semibold text-danger">未対応 {result.data.summary.total}件</span>:undefined}/>{!result.ok?<AdminErrorState title="要対応を取得できませんでした。"/>:<><AttentionSummary summary={result.data.summary}/>{result.data.items.length?<AttentionQueue items={result.data.items}/>:<AdminEmptyState title="現在、要対応はありません" description="対象期間の業務状態に対応が必要な項目はありません。"/>}<p className="text-xs leading-5 text-foreground-muted">要対応は既存の業務状態から都度算出されます。元の状態が解消されると、この一覧からも自動的に外れます。</p></>}</AdminPage>;
}
