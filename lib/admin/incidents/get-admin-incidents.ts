import "server-only";
import { requireAdmin } from "@/lib/auth/require-admin";
import { readAllPages } from "@/lib/admin/shifts/read-all-pages";
import { createClient } from "@/lib/supabase/server";
import type { OperationalIncidentCategory, OperationalIncidentState } from "@/lib/worker/incidents/worker-incident-ui";
import { filterAndSortAdminIncidents, paginateAdminIncidents } from "./incident-rules";
import type { AdminIncident, AdminIncidentEvent, AdminIncidentQuery } from "./incident-types";

type RootRow = { id:string;assignment_id:string;category:OperationalIncidentCategory;message:string|null;state:OperationalIncidentState;version:number;created_at:string;acknowledged_at:string|null;resolved_at:string|null;retracted_at:string|null;assignments:{worker_id:string;workers:{display_name:string;staff_code:string};shift_slots:{id:string;starts_at:string;ends_at:string;jobs:{name:string;projects:{id:string;name:string};workplaces:{name:string}}}} };
type EventRow = { id:string;event_type:AdminIncidentEvent["eventType"];version_from:number;version_to:number;created_at:string;profiles:{display_name:string;account_type:AdminIncidentEvent["actorType"]} };
const select = `id,assignment_id,category,message,state,version,created_at,acknowledged_at,resolved_at,retracted_at,assignments!inner(worker_id,workers!inner(display_name,staff_code),shift_slots!inner(id,starts_at,ends_at,jobs!inner(name,projects!inner(id,name),workplaces!inner(name))))`;

function mapRoot(row: RootRow): AdminIncident {
  const assignment=row.assignments,shift=assignment.shift_slots,job=shift.jobs;
  return {id:row.id,assignmentId:row.assignment_id,category:row.category,message:row.message,state:row.state,version:row.version,createdAt:row.created_at,acknowledgedAt:row.acknowledged_at,resolvedAt:row.resolved_at,retractedAt:row.retracted_at,workerId:assignment.worker_id,workerName:assignment.workers.display_name,staffCode:assignment.workers.staff_code,shiftId:shift.id,startsAt:shift.starts_at,endsAt:shift.ends_at,projectId:job.projects.id,projectName:job.projects.name,jobName:job.name,workplaceName:job.workplaces.name};
}

export async function getAdminIncidents(query: AdminIncidentQuery) {
  await requireAdmin();
  try {
    const supabase=await createClient();
    const rows=await readAllPages<RootRow>(async(from,to)=>{const result=await supabase.from("operational_incidents").select(select,{count:"exact"}).order("id").range(from,to);return result as unknown as {data:RootRow[]|null;error:unknown;count:number|null};});
    const all=rows.map(mapRoot); const filtered=filterAndSortAdminIncidents(all,query); const pagination=paginateAdminIncidents(filtered,query.page);
    const selected=query.incident?all.find(item=>item.id===query.incident):undefined;
    let events:AdminIncidentEvent[]=[];
    if(selected){const result=await supabase.from("operational_incident_events").select("id,event_type,version_from,version_to,created_at,profiles!inner(display_name,account_type)").eq("incident_id",selected.id).order("version_to").limit(20);if(result.error)throw result.error;events=((result.data??[]) as unknown as EventRow[]).map(row=>({id:row.id,eventType:row.event_type,actorName:row.profiles.display_name,actorType:row.profiles.account_type,versionFrom:row.version_from,versionTo:row.version_to,createdAt:row.created_at}));}
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    return {ok:true as const,...pagination,selected,events,summary:{open:all.filter(i=>i.state==="open").length,acknowledged:all.filter(i=>i.state==="acknowledged").length,resolvedToday:all.filter(i=>i.state==="resolved"&&i.resolvedAt?.startsWith(today)).length}};
  } catch(error){console.error("Failed to load admin incidents",error);return{ok:false as const};}
}
