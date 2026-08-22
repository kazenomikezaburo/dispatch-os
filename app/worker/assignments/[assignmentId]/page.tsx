import { notFound } from "next/navigation";
import { requireWorker } from "@/lib/auth/require-worker";
import { getWorkerAssignment } from "@/lib/worker/get-worker-assignment";
import { WorkerAssignmentDetail } from "@/components/worker/worker-assignment-detail";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function WorkerAssignmentPage({ params }: PageProps<"/worker/assignments/[assignmentId]">) {
  const id = uuidSchema.safeParse((await params).assignmentId);
  if (!id.success) notFound();
  const profile = await requireWorker();
  const result = await getWorkerAssignment(profile.id, id.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><section role="alert" className="rounded-xl border border-red-200 bg-white p-5"><h1 className="font-semibold text-slate-950">勤務詳細を取得できませんでした。</h1><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></section></main>;
  return <WorkerAssignmentDetail assignment={result.assignment} />;
}
