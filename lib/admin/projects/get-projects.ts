import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildProjectList,
  getTokyoDateRange,
  type JobInput,
  type ProjectInput,
} from "./project-rules";
import type {
  ProjectQuery,
  ProjectsResult,
  ProjectStatus,
} from "./project-types";

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  clients: { name: string } | null;
};

type JobRow = {
  id: string;
  project_id: string;
  shift_slots: { id: string; required_workers: number }[];
};

export async function getProjects(filters: ProjectQuery): Promise<ProjectsResult> {
  try {
    const supabase = await createClient();
    const range = getTokyoDateRange();

    const runProjectQuery = (mode: "all" | "name" | "clients", clientIds: string[] = []) => {
      let query = supabase
        .from("projects")
        .select("id, name, status, start_date, end_date, clients(name)");

      if (filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.period === "upcoming") query = query.gte("end_date", range.date);
      if (filters.period === "past") query = query.lt("end_date", range.date);
      if (filters.period === "this_month") {
        query = query.lt("start_date", range.nextMonthStart).gte("end_date", range.monthStart);
      }
      if (mode === "name") query = query.ilike("name", `%${filters.q}%`);
      if (mode === "clients") query = query.in("client_id", clientIds);
      return query;
    };

    let projectRows: ProjectRow[];
    if (filters.q) {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", `%${filters.q}%`);
      if (clientError) throw clientError;

      const clientIds = (clientData ?? []).map((client) => client.id);
      const [nameResult, clientResult] = await Promise.all([
        runProjectQuery("name"),
        clientIds.length > 0 ? runProjectQuery("clients", clientIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (nameResult.error) throw nameResult.error;
      if (clientResult.error) throw clientResult.error;
      const uniqueRows = new Map<string, ProjectRow>();
      for (const row of [...(nameResult.data ?? []), ...(clientResult.data ?? [])] as unknown as ProjectRow[]) {
        uniqueRows.set(row.id, row);
      }
      projectRows = [...uniqueRows.values()];
    } else {
      const result = await runProjectQuery("all");
      if (result.error) throw result.error;
      projectRows = (result.data ?? []) as unknown as ProjectRow[];
    }

    const projects: ProjectInput[] = projectRows.map((row) => ({
      id: row.id,
      name: row.name,
      clientName: row.clients?.name ?? "取引先未設定",
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
    }));
    if (projects.length === 0) return { ok: true, projects: [] };

    const projectIds = projects.map((project) => project.id);
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("id, project_id, shift_slots(id, required_workers)")
      .in("project_id", projectIds);
    if (jobError) throw jobError;

    const jobRows = (jobData ?? []) as unknown as JobRow[];
    const jobs: JobInput[] = jobRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      shifts: row.shift_slots.map((shift) => ({
        id: shift.id,
        requiredWorkers: shift.required_workers,
      })),
    }));
    const shiftIds = jobs.flatMap((job) => job.shifts.map((shift) => shift.id));
    if (shiftIds.length === 0) {
      return { ok: true, projects: buildProjectList(projects, jobs, []) };
    }

    const { data: assignmentData, error: assignmentError } = await supabase
      .from("assignments")
      .select("shift_slot_id")
      .in("shift_slot_id", shiftIds)
      .in("status", ["assigned", "confirmed", "completed"]);
    if (assignmentError) throw assignmentError;

    return {
      ok: true,
      projects: buildProjectList(
        projects,
        jobs,
        (assignmentData ?? []).map((assignment) => assignment.shift_slot_id),
      ),
    };
  } catch (error: unknown) {
    console.error("Failed to load admin project list", error);
    return { ok: false };
  }
}
