import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readAllPages } from "@/lib/admin/shifts/read-all-pages";
import { preShiftRange, type PreShiftItem } from "./pre-shift-rules";

type Row = { id:string; status:string; worker_id:string; workers:{display_name:string}; shift_slots:{id:string;starts_at:string;ends_at:string;jobs:{id:string;name:string;projects:{id:string;name:string};workplaces:{id:string;name:string}}}; pre_shift_confirmations:{can_work:boolean;health_status:"good"|"concern"|"unwell";planned_wake_at:string|null;planned_departure_at:string|null;comment:string|null;submitted_at:string;updated_at:string}[] };
export async function getPreShiftMonitor(date: string): Promise<{ok:true;items:PreShiftItem[]}|{ok:false}> {
  try {
    const supabase = await createClient(); const range = preShiftRange(date);
    const rows = await readAllPages<Row>(async (from,to) => {
      const result = await supabase.from("assignments").select(`id,status,worker_id,workers!inner(display_name),shift_slots!inner(id,starts_at,ends_at,jobs!inner(id,name,projects!inner(id,name),workplaces!inner(id,name))),pre_shift_confirmations(can_work,health_status,planned_wake_at,planned_departure_at,comment,submitted_at,updated_at)`, { count:"exact" }).in("status",["assigned","confirmed","completed"]).gte("shift_slots.starts_at",range.start).lt("shift_slots.starts_at",range.end).order("id").range(from,to);
      return result as unknown as { data: Row[] | null; error: unknown; count: number | null };
    });
    return { ok:true, items: rows.map((row) => { const c=row.pre_shift_confirmations[0]; return { assignmentId:row.id,assignmentStatus:row.status,workerId:row.worker_id,workerName:row.workers.display_name,shiftId:row.shift_slots.id,startsAt:row.shift_slots.starts_at,endsAt:row.shift_slots.ends_at,projectId:row.shift_slots.jobs.projects.id,projectName:row.shift_slots.jobs.projects.name,jobId:row.shift_slots.jobs.id,jobName:row.shift_slots.jobs.name,workplaceId:row.shift_slots.jobs.workplaces.id,workplaceName:row.shift_slots.jobs.workplaces.name,confirmation:c?{canWork:c.can_work,healthStatus:c.health_status,plannedWakeAt:c.planned_wake_at,plannedDepartureAt:c.planned_departure_at,comment:c.comment,submittedAt:c.submitted_at,updatedAt:c.updated_at}:null }; }) };
  } catch (error) { console.error("Failed to load admin pre-shift monitor", error); return {ok:false}; }
}
