import { redirect, notFound } from "next/navigation";
import { uuidSchema } from "@/lib/utils/uuid-schema";

// Keep bookmarked URLs. New and old entry points share the same editor.
export default async function BulkNewShiftPage({ params }: PageProps<"/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new">) {
  const values = await params;
  const project = uuidSchema.safeParse(values.projectId);
  const job = uuidSchema.safeParse(values.jobId);
  if (!project.success || !job.success) notFound();
  redirect(`/admin/projects/${project.data}/jobs/${job.data}/shifts/new`);
}
