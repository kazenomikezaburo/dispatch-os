import { redirect, notFound } from "next/navigation";
import { uuidSchema } from "@/lib/utils/uuid-schema";

// Keep bookmarked URLs without retaining a duplicate create surface.
export default async function BulkNewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new">) {
  const values = await params;
  const project = uuidSchema.safeParse(values.projectId);
  const job = uuidSchema.safeParse(values.jobId);
  if (!project.success || !job.success) notFound();
  redirect(`/admin/shifts/new?${new URLSearchParams({ projectId: project.data, jobId: job.data }).toString()}`);
}
