import { WorkerRecruitmentList } from "@/components/worker/recruitment/worker-recruitment";
import { getWorkerRecruitment } from "@/lib/worker/recruitment/get-worker-recruitment";

export default async function WorkerRecruitmentPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) { const query = await searchParams; const page = /^\d+$/.test(query.page ?? "") ? Math.min(Number(query.page), 999) : 0; const result = await getWorkerRecruitment(page); return <WorkerRecruitmentList items={result.items} hasMore={result.hasMore} page={page} />; }
