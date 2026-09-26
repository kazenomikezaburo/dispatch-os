import { WorkerAvailabilityWorkspace } from "@/components/worker/availability/worker-availability-workspace";
import { requireWorker } from "@/lib/auth/require-worker";
import { getOwnWorkerAvailability } from "@/lib/worker/availability/get-worker-availability";

export default async function WorkerAvailabilityPage() {
  await requireWorker();
  const result = await getOwnWorkerAvailability();
  if (!result.ok) return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><section role="alert" className="rounded-panel border border-danger bg-surface p-5"><h1 className="text-lg font-semibold">勤務条件を取得できませんでした。</h1><p className="mt-1 text-sm text-foreground-secondary">時間をおいて再度お試しください。</p></section></main>;
  return <WorkerAvailabilityWorkspace data={result.data} />;
}
