import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ASSIGNMENT_STATUSES } from "./project-rules";
import { buildProjectDetail, type DetailJobInput } from "./project-detail-rules";
import type { JobStatus, ProjectDetailResult, ShiftStatus } from "./project-detail-types";
import type { ProjectStatus } from "./project-types";

type ProjectRow = { id: string; branch_id: string; name: string; status: ProjectStatus; start_date: string; end_date: string; description: string | null; clients: { name: string } | null };
type JobRow = { id: string; project_id: string; name: string; status: JobStatus; workplaces: { id: string; name: string; address: string }; shift_slots: { id: string; label: string | null; starts_at: string; ends_at: string; status: ShiftStatus; required_workers: number }[] };

export async function getProjectDetail(projectId: string): Promise<ProjectDetailResult> {
  try {
    const supabase = await createClient();
    const projectResult = await supabase.from("projects").select("id, branch_id, name, status, start_date, end_date, description, clients(name)").eq("id", projectId).maybeSingle();
    if (projectResult.error) throw projectResult.error;
    if (!projectResult.data) return { ok: false, reason: "not_found" };
    const project = projectResult.data as unknown as ProjectRow;

    const jobsResult = await supabase.from("jobs").select("id, project_id, name, status, workplaces(id, name, address), shift_slots(id, label, starts_at, ends_at, status, required_workers)").eq("project_id", projectId);
    if (jobsResult.error) throw jobsResult.error;
    const rows = (jobsResult.data ?? []) as unknown as JobRow[];
    const jobs: DetailJobInput[] = rows.map((job) => ({ id: job.id, projectId: job.project_id, name: job.name, status: job.status, workplace: job.workplaces, shifts: job.shift_slots.map((shift) => ({ id: shift.id, label: shift.label, startsAt: shift.starts_at, endsAt: shift.ends_at, status: shift.status, requiredWorkers: shift.required_workers })) }));
    const shiftIds = jobs.flatMap((job) => job.shifts.map((shift) => shift.id));
    let activeAssignmentShiftIds: string[] = [];
    if (shiftIds.length > 0) {
      const assignmentsResult = await supabase.from("assignments").select("shift_slot_id").in("shift_slot_id", shiftIds).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]);
      if (assignmentsResult.error) throw assignmentsResult.error;
      activeAssignmentShiftIds = (assignmentsResult.data ?? []).map((assignment) => assignment.shift_slot_id);
    }
    return { ok: true, detail: buildProjectDetail({ id: project.id, name: project.name, branchId: project.branch_id, clientName: project.clients?.name ?? "取引先未設定", status: project.status, startDate: project.start_date, endDate: project.end_date, description: project.description }, jobs, activeAssignmentShiftIds) };
  } catch (error: unknown) {
    console.error("Failed to load admin project detail", error);
    return { ok: false, reason: "error" };
  }
}
