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
    const workplaces = await supabase.from("workplaces").select("id, branch_id, name, postal_code, address, default_transport_note, access_note, meeting_note, is_active, created_at, updated_at, jobs(count)").eq("branch_id", project.data.branch_id).order("name");
    if (workplaces.error) throw workplaces.error;
    return { ok: true, options: { project: { id: project.data.id, name: project.data.name, status: project.data.status as ProjectStatus, branchId: project.data.branch_id }, workplaces: (workplaces.data ?? []).map((row) => ({ id: row.id, branchId: row.branch_id, name: row.name, postalCode: row.postal_code, address: row.address, defaultTransportNote: row.default_transport_note, accessNote: row.access_note, meetingNote: row.meeting_note, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at, jobCount: row.jobs?.[0]?.count ?? 0 })) } };
  } catch (error: unknown) {
    console.error("Failed to load job form options", error);
    return { ok: false, reason: "error" };
  }
}
