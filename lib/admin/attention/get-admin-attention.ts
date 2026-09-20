import "server-only";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { deriveAdminAttendance } from "@/lib/admin/attendance/attendance-rules";
import { placementCoverageShortages } from "@/lib/admin/placement/placement-editor-rules";
import type { PlacementPlan } from "@/lib/admin/placement/placement-types";
import { ACTIVE_ASSIGNMENT_STATUSES, getStaffingState } from "@/lib/admin/shifts/shift-list-rules";
import { addDays, tokyoDate } from "@/lib/admin/shifts/shift-view-rules";
import { readAllPages } from "@/lib/admin/shifts/read-all-pages";
import { getPreShiftConfirmationOpenAt, getPreShiftConfirmationState } from "@/lib/domain/pre-shift-confirmation";
import { buildAttentionData, type AttentionSources, type PlacementAttentionSource } from "./attention-rules";
import type { AttentionResult } from "./attention-types";

export const ATTENTION_WINDOW_DAYS = 8;
export const ATTENTION_QUEUE_LIMIT = 100;
const activeStatuses = new Set<string>(ACTIVE_ASSIGNMENT_STATUSES);

type ShiftRow = { id:string;starts_at:string;ends_at:string;required_workers:number;break_minutes:number|null;status:string;jobs:{name:string;projects:{id:string;name:string};workplaces:{name:string}} };
type ConfirmationRow = { submitted_at:string };
type AssignmentRow = { id:string;shift_slot_id:string;worker_id:string;status:string;workers:{display_name:string};pre_shift_confirmations:ConfirmationRow|ConfirmationRow[]|null };
type EventRow = { assignment_id:string;event_type:"start_work"|"end_work";server_received_at:string };
type AttendanceRecordRow = { assignment_id:string;actual_start_at:string|null };
type IncidentRow = { id:string;assignment_id:string;state:"open";created_at:string };
type PlanRow = { id:string;shift_slot_id:string;version:number };
type PositionRow = { id:string;plan_id:string;label:string;required_workers:number|null;display_order:number;retired_at:string|null };
type SegmentRow = { id:string;plan_id:string;assignment_id:string;position_id:string;start_at:string;end_at:string };
type BreakRow = { id:string;plan_id:string;assignment_id:string;start_at:string;end_at:string };

export async function getAdminAttention(now = new Date()): Promise<AttentionResult> {
  await requireAdmin();
  try {
    const supabase = await createClient();
    const fromDate = tokyoDate(now);
    const toDate = addDays(fromDate, ATTENTION_WINDOW_DAYS);
    const window = { from:new Date(`${fromDate}T00:00:00+09:00`).toISOString(),to:new Date(`${toDate}T00:00:00+09:00`).toISOString() };
    const shifts = await readAllPages<ShiftRow>(async(from,to)=>{
      const result=await supabase.from("shift_slots").select("id,starts_at,ends_at,required_workers,break_minutes,status,jobs!inner(name,projects!inner(id,name),workplaces!inner(name))",{count:"exact"}).neq("status","cancelled").gte("starts_at",window.from).lt("starts_at",window.to).order("starts_at").order("id").range(from,to);
      return result as unknown as {data:ShiftRow[]|null;error:unknown;count:number|null};
    });
    if (!shifts.length) return {ok:true,data:buildAttentionData(emptySources(),window)};

    const shiftById=new Map(shifts.map(shift=>[shift.id,shift]));
    const assignments:AssignmentRow[]=[];
    for(const ids of chunks(shifts.map(shift=>shift.id))){
      const rows=await readAllPages<AssignmentRow>(async(from,to)=>{const result=await supabase.from("assignments").select("id,shift_slot_id,worker_id,status,workers!inner(display_name),pre_shift_confirmations(submitted_at)",{count:"exact"}).in("shift_slot_id",ids).in("status",["assigned","confirmed","completed","absent","no_show"]).order("id").range(from,to);return result as unknown as {data:AssignmentRow[]|null;error:unknown;count:number|null};});
      assignments.push(...rows);
    }
    const assignmentIds=assignments.map(row=>row.id);
    const shiftIds=shifts.map(row=>row.id);
    const [events,records,incidents,plans]=await Promise.all([
      readBatched<EventRow>(assignmentIds,ids=>supabase.from("attendance_events").select("assignment_id,event_type,server_received_at").in("assignment_id",ids).in("event_type",["start_work","end_work"]).order("server_received_at")),
      readBatched<AttendanceRecordRow>(assignmentIds,ids=>supabase.from("attendance_records").select("assignment_id,actual_start_at").in("assignment_id",ids)),
      readBatched<IncidentRow>(assignmentIds,ids=>supabase.from("operational_incidents").select("id,assignment_id,state,created_at").in("assignment_id",ids).eq("state","open").order("created_at")),
      readBatched<PlanRow>(shiftIds,ids=>supabase.from("shift_placement_plans").select("id,shift_slot_id,version").in("shift_slot_id",ids)),
    ]);
    const planIds=plans.map(plan=>plan.id);
    const [positions,segments,breaks]=await Promise.all([
      readBatched<PositionRow>(planIds,ids=>supabase.from("shift_positions").select("id,plan_id,label,required_workers,display_order,retired_at").in("plan_id",ids)),
      readBatched<SegmentRow>(planIds,ids=>supabase.from("assignment_placement_segments").select("id,plan_id,assignment_id,position_id,start_at,end_at").in("plan_id",ids)),
      readBatched<BreakRow>(planIds,ids=>supabase.from("assignment_break_intervals").select("id,plan_id,assignment_id,start_at,end_at").in("plan_id",ids)),
    ]);

    const activeByShift=new Map<string,AssignmentRow[]>();
    for(const assignment of assignments){if(!activeStatuses.has(assignment.status))continue;const rows=activeByShift.get(assignment.shift_slot_id)??[];rows.push(assignment);activeByShift.set(assignment.shift_slot_id,rows);}
    const eventMap=new Map<string,{start:string|null;end:string|null}>();
    for(const event of events){const value=eventMap.get(event.assignment_id)??{start:null,end:null};if(event.event_type==="start_work"&&!value.start)value.start=event.server_received_at;if(event.event_type==="end_work"&&!value.end)value.end=event.server_received_at;eventMap.set(event.assignment_id,value);}
    const confirmedAssignments=new Set(records.map(record=>record.assignment_id));
    const recordByAssignment=new Map(records.map(record=>[record.assignment_id,record]));

    const sources:AttentionSources=emptySources();
    sources.staffing=shifts.map(shift=>{const assignedWorkers=activeByShift.get(shift.id)?.length??0;return{shiftId:shift.id,projectId:shift.jobs.projects.id,projectName:shift.jobs.projects.name,jobName:shift.jobs.name,workplaceName:shift.jobs.workplaces.name,startsAt:shift.starts_at,requiredWorkers:shift.required_workers,assignedWorkers,staffingState:getStaffingState(shift.required_workers,assignedWorkers)};});
    for(const assignment of assignments){
      const shift=shiftById.get(assignment.shift_slot_id);if(!shift)continue;const event=eventMap.get(assignment.id);const attendance=deriveAdminAttendance({id:assignment.id,shiftId:shift.id,status:assignment.status,workerName:assignment.workers.display_name,startsAt:shift.starts_at,endsAt:shift.ends_at,projectName:shift.jobs.projects.name,jobName:shift.jobs.name,workplaceName:shift.jobs.workplaces.name,startWorkAt:event?.start??null,endWorkAt:event?.end??null},now,confirmedAssignments.has(assignment.id)?"confirmed":"unconfirmed");
      if(activeStatuses.has(assignment.status)){const confirmation=Array.isArray(assignment.pre_shift_confirmations)?assignment.pre_shift_confirmations[0]:assignment.pre_shift_confirmations;sources.preConfirmations.push({assignmentId:assignment.id,shiftId:shift.id,projectId:shift.jobs.projects.id,projectName:shift.jobs.projects.name,workerName:assignment.workers.display_name,workplaceName:shift.jobs.workplaces.name,startsAt:shift.starts_at,openAt:getPreShiftConfirmationOpenAt(shift.starts_at).toISOString(),state:getPreShiftConfirmationState({startsAt:shift.starts_at,hasConfirmation:Boolean(confirmation),now}),beforeStart:now.getTime()<Date.parse(shift.starts_at)});}
      const officialStartAt=recordByAssignment.get(assignment.id)?.actual_start_at??attendance.startWorkAt;
      const officialLateMinutes=officialStartAt?Math.max(0,Math.floor((Date.parse(officialStartAt)-Date.parse(shift.starts_at))/60000)):attendance.lateMinutes;
      sources.dayOf.push({assignmentId:assignment.id,shiftId:shift.id,projectId:shift.jobs.projects.id,projectName:shift.jobs.projects.name,workerName:assignment.workers.display_name,workplaceName:shift.jobs.workplaces.name,startsAt:shift.starts_at,startWorkAt:officialStartAt,state:attendance.state,lateMinutes:officialLateMinutes});
      sources.attendanceReviews.push({assignmentId:assignment.id,shiftId:shift.id,projectId:shift.jobs.projects.id,projectName:shift.jobs.projects.name,workerName:assignment.workers.display_name,workplaceName:shift.jobs.workplaces.name,startsAt:shift.starts_at,endWorkAt:attendance.endWorkAt,state:attendance.state,confirmationState:attendance.confirmationState});
    }
    sources.incidents=incidents.flatMap(incident=>{const assignment=assignments.find(row=>row.id===incident.assignment_id);const shift=assignment?shiftById.get(assignment.shift_slot_id):undefined;return assignment&&shift?[{incidentId:incident.id,assignmentId:assignment.id,shiftId:shift.id,projectId:shift.jobs.projects.id,projectName:shift.jobs.projects.name,workerName:assignment.workers.display_name,workplaceName:shift.jobs.workplaces.name,startsAt:shift.starts_at,createdAt:incident.created_at,state:incident.state}]:[];});
    sources.placement=buildPlacementSources(plans,positions,segments,breaks,shifts,activeByShift,now);
    const data=buildAttentionData(sources,window);
    return {ok:true,data:{...data,items:data.items.slice(0,ATTENTION_QUEUE_LIMIT)}};
  }catch(error){console.error("Failed to load Admin Attention Center",error);return{ok:false};}
}

function buildPlacementSources(plans:PlanRow[],positions:PositionRow[],segments:SegmentRow[],breaks:BreakRow[],shifts:ShiftRow[],activeByShift:Map<string,AssignmentRow[]>,now:Date):PlacementAttentionSource[]{
  const shiftById=new Map(shifts.map(shift=>[shift.id,shift]));const result:PlacementAttentionSource[]=[];
  for(const plan of plans){const shift=shiftById.get(plan.shift_slot_id);if(!shift)continue;const placementPlan:PlacementPlan={planId:plan.id,version:plan.version,shiftId:shift.id,startsAt:shift.starts_at,endsAt:shift.ends_at,requiredWorkers:shift.required_workers,breakMinutes:shift.break_minutes,correctionRequired:false,positions:positions.filter(row=>row.plan_id===plan.id).map(row=>({id:row.id,label:row.label,requiredWorkers:row.required_workers,displayOrder:row.display_order,retired:row.retired_at!==null})),segments:segments.filter(row=>row.plan_id===plan.id).map(row=>({id:row.id,assignmentId:row.assignment_id,positionId:row.position_id,startAt:row.start_at,endAt:row.end_at})),breaks:breaks.filter(row=>row.plan_id===plan.id).map(row=>({id:row.id,assignmentId:row.assignment_id,startAt:row.start_at,endAt:row.end_at})),assignments:(activeByShift.get(shift.id)??[]).map(row=>({assignmentId:row.id,status:row.status as "assigned"|"confirmed"|"completed",worker:null}))};
    const grouped=new Map<string,ReturnType<typeof placementCoverageShortages>[number]>();for(const shortage of placementCoverageShortages(placementPlan)){const existing=grouped.get(shortage.position.id);const current=Date.parse(shortage.startAt)<=now.getTime()&&now.getTime()<Date.parse(shortage.endAt);const existingCurrent=existing?Date.parse(existing.startAt)<=now.getTime()&&now.getTime()<Date.parse(existing.endAt):false;if(!existing||current&&!existingCurrent||current===existingCurrent&&shortage.startAt<existing.startAt)grouped.set(shortage.position.id,shortage);}for(const shortage of grouped.values())result.push({planId:plan.id,positionId:shortage.position.id,positionLabel:shortage.position.label,shiftId:shift.id,projectId:shift.jobs.projects.id,projectName:shift.jobs.projects.name,jobName:shift.jobs.name,workplaceName:shift.jobs.workplaces.name,startsAt:shift.starts_at,intervalStart:shortage.startAt,intervalEnd:shortage.endAt,shortage:shortage.shortage,current:Date.parse(shortage.startAt)<=now.getTime()&&now.getTime()<Date.parse(shortage.endAt)});
  }
  return result;
}

function emptySources():AttentionSources{return{staffing:[],placement:[],preConfirmations:[],dayOf:[],incidents:[],attendanceReviews:[]};}
function chunks<T>(values:T[],size=100){return Array.from({length:Math.ceil(values.length/size)},(_,index)=>values.slice(index*size,(index+1)*size));}
async function readBatched<T>(ids:string[],query:(ids:string[])=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<T[]>{const rows:T[]=[];for(const batch of chunks(ids)){if(!batch.length)continue;const result=await query(batch);if(result.error)throw result.error;rows.push(...(result.data??[]));}return rows;}
