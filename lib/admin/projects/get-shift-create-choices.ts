import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ShiftCreateProjectChoice = { id: string; name: string };
export type ShiftCreateJobChoice = { id: string; projectId: string; name: string; workplaceName: string };
export type ShiftCreateChoicesResult =
  | { ok: true; projects: ShiftCreateProjectChoice[]; jobs: ShiftCreateJobChoice[] }
  | { ok: false };

export async function getShiftCreateChoices(projectId?: string): Promise<ShiftCreateChoicesResult> {
  try {
    const supabase = await createClient();
    const projectsResult = await supabase.from("projects").select("id, name").order("name");
    if (projectsResult.error) throw projectsResult.error;

    if (!projectId || !(projectsResult.data ?? []).some((project) => project.id === projectId)) {
      return { ok: true, projects: projectsResult.data ?? [], jobs: [] };
    }

    const jobsResult = await supabase
      .from("jobs")
      .select("id, project_id, name, workplaces(name)")
      .eq("project_id", projectId)
      .order("name");
    if (jobsResult.error) throw jobsResult.error;

    return {
      ok: true,
      projects: projectsResult.data ?? [],
      jobs: (jobsResult.data ?? []).map((job) => ({
        id: job.id,
        projectId: job.project_id,
        name: job.name,
        workplaceName: (job.workplaces as unknown as { name: string }).name,
      })),
    };
  } catch (error: unknown) {
    console.error("Failed to load canonical shift create choices", error);
    return { ok: false };
  }
}
