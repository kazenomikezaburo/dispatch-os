import { notFound } from "next/navigation";
import { AdminErrorState } from "@/components/admin/admin-state";
import { WorkerDetailView } from "@/components/admin/workers/worker-detail-view";
import { getWorkerDetail } from "@/lib/admin/workers/get-worker-detail";
import { parseHistoryPage,parseWorkerTab } from "@/lib/admin/workers/worker-rules";
type Props={params:Promise<{workerId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
export default async function WorkerDetailPage({params,searchParams}:Props){const[{workerId},query]=await Promise.all([params,searchParams]);const tab=parseWorkerTab(query.tab);const historyPage=parseHistoryPage(query.historyPage);const result=await getWorkerDetail(workerId,historyPage);if(!result.ok){if(result.reason==="not_found")notFound();return <AdminErrorState title="スタッフ詳細を取得できませんでした。"/>}return <WorkerDetailView detail={result.detail} tab={tab} historyPage={historyPage} canEdit={result.canEdit}/>}
