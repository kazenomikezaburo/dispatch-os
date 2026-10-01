import { WorkerHome } from "@/components/worker/home/worker-home";
import { requireWorker } from "@/lib/auth/require-worker";
import { getWorkerAssignments } from "@/lib/worker/get-worker-assignment";
import { getWorkerRecruitment } from "@/lib/worker/recruitment/get-worker-recruitment";

export default async function WorkerPage() {
  const profile = await requireWorker();
  const assignmentsPromise = getWorkerAssignments(profile.id);
  const recruitmentPromise = getWorkerRecruitment(0).catch((error: unknown) => {
    console.error("Failed to load Worker home recruitment preview", error);
    return null;
  });
  const [assignmentResult, recruitmentResult] = await Promise.all([assignmentsPromise, recruitmentPromise]);
  return <WorkerHome displayName={profile.display_name} assignments={assignmentResult.ok ? assignmentResult.assignments : null} recruitment={recruitmentResult?.items ?? null} />;
}
