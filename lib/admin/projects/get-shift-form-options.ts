import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ShiftFormOptionsResult } from "./shift-form-types";
import type { ProjectStatus } from "./project-types";
import type { JobStatus } from "./project-detail-types";

export async function getShiftFormOptions(projectId: string, jobId: string): Promise<ShiftFormOptionsResult> {
  try {
    const supabase = await createClient();
    const [project, job] = await Promise.all([
      supabase.from("projects").select("id, name, status").eq("id", projectId).maybeSingle(),
      supabase.from("jobs").select("id, project_id, name, status, hourly_wage, transportation_fee_cap, workplaces(name)").eq("id", jobId).eq("project_id", projectId).maybeSingle(),
    ]);
    if (project.error) throw project.error;
    if (job.error) throw job.error;
    if (!project.data || !job.data) return { ok: false, reason: "not_found" };
    const workplace = job.data.workplaces as unknown as { name: string };
    return { ok: true, options: { project: { id: project.data.id, name: project.data.name, status: project.data.status as ProjectStatus }, job: { id: job.data.id, name: job.data.name, status: job.data.status as JobStatus, workplaceName: workplace.name, hourlyWage: job.data.hourly_wage, transportationFeeCap: job.data.transportation_fee_cap } } };
  } catch (error: unknown) {
    console.error("Failed to load shift form options", error);
    return { ok: false, reason: "error" };
  }
}
