import { notFound, redirect } from "next/navigation";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function NewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/new">) {
  const values = await params;
  const projectId = uuidSchema.safeParse(values.projectId);
  const jobId = uuidSchema.safeParse(values.jobId);
  if (!projectId.success || !jobId.success) notFound();
  redirect(`/admin/shifts/new?${new URLSearchParams({ projectId: projectId.data, jobId: jobId.data }).toString()}`);
}
