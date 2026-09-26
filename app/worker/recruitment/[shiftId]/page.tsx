import { notFound } from "next/navigation";
import { WorkerRecruitmentDetail } from "@/components/worker/recruitment/worker-recruitment";
import { getWorkerRecruitmentShift } from "@/lib/worker/recruitment/get-worker-recruitment";

export default async function WorkerRecruitmentDetailPage({ params }: { params: Promise<{ shiftId: string }> }) { const { shiftId } = await params; const item = await getWorkerRecruitmentShift(shiftId); if (!item) notFound(); return <WorkerRecruitmentDetail item={item} />; }
