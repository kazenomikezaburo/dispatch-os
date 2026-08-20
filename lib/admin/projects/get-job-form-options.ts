import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JobFormOptionsResult } from "./job-form-types";
import type { ProjectStatus } from "./project-types";

export async function getJobFormOptions(projectId: string): Promise<JobFormOptionsResult> {
  try {
    const supabase = await createClient();
    const project = await supabase.from("projects").select("id, name, status, branch_id").eq("id", projectId).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) return { ok: false, reason: "not_found" };
    const workplaces = await supabase.from("workplaces").select("id, name, address").eq("branch_id", project.data.branch_id).eq("is_active", true).order("name");
    if (workplaces.error) throw workplaces.error;
    return { ok: true, options: { project: { id: project.data.id, name: project.data.name, status: project.data.status as ProjectStatus }, workplaces: workplaces.data ?? [] } };
  } catch (error: unknown) {
    console.error("Failed to load job form options", error);
    return { ok: false, reason: "error" };
  }
}
