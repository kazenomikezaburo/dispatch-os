import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { WORKER_PAGE_SIZE, type WorkerListQuery } from "./worker-rules";
import type { WorkerBranchOption, WorkerListItem, WorkerStatus } from "./worker-types";

type Row = { id:string;staff_code:string;display_name:string;status:WorkerStatus;branch_id:string;branches:{name:string} };
type AssignmentRow = { worker_id:string;shift_slots:{starts_at:string;jobs:{workplaces:{name:string}}} };

export async function getWorkers(query: WorkerListQuery) {
  try {
    const supabase = await createClient();
    const actorPromise = getCurrentProfile();
    let rowsQuery = supabase.from("workers").select("id, staff_code, display_name, status, branch_id, branches!inner(name)", { count: "exact" });
    if (query.q) rowsQuery = rowsQuery.or(`display_name.ilike.%${query.q.replaceAll("%", "\\%").replaceAll(",", "") }%,staff_code.ilike.%${query.q.replaceAll("%", "\\%").replaceAll(",", "")}%`);
    if (query.status !== "all") rowsQuery = rowsQuery.eq("status", query.status);
    const from = (query.page - 1) * WORKER_PAGE_SIZE;
    const [rowsResult, allCount, activeCount, inactiveCount, branchesResult, actor] = await Promise.all([
      rowsQuery.order("display_name").order("id").range(from, from + WORKER_PAGE_SIZE - 1),
      supabase.from("workers").select("id", { count: "exact", head: true }),
      supabase.from("workers").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("workers").select("id", { count: "exact", head: true }).in("status", ["inactive", "suspended"]),
      supabase.from("branches").select("id, name").order("name"),
      actorPromise,
    ]);
    if (rowsResult.error || allCount.error || activeCount.error || inactiveCount.error || branchesResult.error) throw rowsResult.error ?? allCount.error ?? activeCount.error ?? inactiveCount.error ?? branchesResult.error;
    const rows = (rowsResult.data ?? []) as unknown as Row[];
    let assignments: AssignmentRow[] = [];
    if (rows.length) {
      const result = await supabase.from("assignments").select("worker_id, shift_slots!inner(starts_at, jobs!inner(workplaces!inner(name)))").in("worker_id", rows.map(row => row.id)).lte("shift_slots.starts_at", new Date().toISOString()).in("status", ["completed", "absent", "no_show"]).order("starts_at", { referencedTable: "shift_slots", ascending: false }).limit(rows.length * 5);
      if (result.error) throw result.error;
      assignments = (result.data ?? []) as unknown as AssignmentRow[];
    }
    const recentByWorker = new Map<string, AssignmentRow>();
    for (const assignment of assignments) if (!recentByWorker.has(assignment.worker_id)) recentByWorker.set(assignment.worker_id, assignment);
    const items: WorkerListItem[] = rows.map(row => { const recent = recentByWorker.get(row.id); return { id:row.id,staffCode:row.staff_code,displayName:row.display_name,status:row.status,branchId:row.branch_id,branchName:row.branches.name,recentWork:recent?{startsAt:recent.shift_slots.starts_at,workplaceName:recent.shift_slots.jobs.workplaces.name}:null }; });
    return { ok:true as const, items, total:rowsResult.count ?? 0, summary:{ total:allCount.count ?? 0, active:activeCount.count ?? 0, unavailable:inactiveCount.count ?? 0 }, branches:(branchesResult.data ?? []) as WorkerBranchOption[], canEdit:actor.status === "authenticated" && actor.profile.account_type === "system_admin" };
  } catch (error) { console.error("Failed to load admin workers", error); return { ok:false as const }; }
}
