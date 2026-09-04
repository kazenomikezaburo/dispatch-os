import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { WORKER_HISTORY_PAGE_SIZE } from "./worker-rules";
import type { WorkerDetail, WorkerHistoryItem, WorkerStatus } from "./worker-types";

type WorkerRow={id:string;staff_code:string;display_name:string;status:WorkerStatus;branch_id:string;created_at:string;updated_at:string;auth_profile_id:string|null;branches:{name:string};profiles:{is_active:boolean}|null};
type AttendanceRow={status:string;actual_start_at:string;actual_end_at:string};
type AssignmentRow={id:string;shift_slot_id:string;status:string;shift_slots:{starts_at:string;ends_at:string;jobs:{id:string;name:string;projects:{id:string;name:string};workplaces:{name:string}}};attendance_records:AttendanceRow|AttendanceRow[]|null};
const mapHistory=(row:AssignmentRow):WorkerHistoryItem=>{const attendance=Array.isArray(row.attendance_records)?row.attendance_records[0]??null:row.attendance_records;return{assignmentId:row.id,shiftId:row.shift_slot_id,startsAt:row.shift_slots.starts_at,endsAt:row.shift_slots.ends_at,assignmentStatus:row.status,projectId:row.shift_slots.jobs.projects.id,projectName:row.shift_slots.jobs.projects.name,jobName:row.shift_slots.jobs.name,workplaceName:row.shift_slots.jobs.workplaces.name,attendance:attendance?{status:attendance.status,actualStartAt:attendance.actual_start_at,actualEndAt:attendance.actual_end_at}:null}};

export async function getWorkerDetail(workerId:string, historyPage:number) {
  try {
    const supabase=await createClient();
    const [workerResult, assignmentsResult, actor]=await Promise.all([
      supabase.from("workers").select("id, staff_code, display_name, status, branch_id, created_at, updated_at, auth_profile_id, branches!inner(name), profiles(is_active)").eq("id",workerId).maybeSingle(),
      supabase.from("assignments").select("id, shift_slot_id, status, shift_slots!inner(starts_at, ends_at, jobs!inner(id, name, projects!inner(id, name), workplaces!inner(name))), attendance_records(status, actual_start_at, actual_end_at)").eq("worker_id",workerId).order("starts_at",{referencedTable:"shift_slots",ascending:false}).limit(200),
      getCurrentProfile(),
    ]);
    if(workerResult.error||assignmentsResult.error)throw workerResult.error??assignmentsResult.error;
    if(!workerResult.data)return{ok:false as const,reason:"not_found" as const};
    const row=workerResult.data as unknown as WorkerRow;
    const all=((assignmentsResult.data??[]) as unknown as AssignmentRow[]).map(mapHistory).sort((a,b)=>b.startsAt.localeCompare(a.startsAt)||b.assignmentId.localeCompare(a.assignmentId));
    const now=Date.now(); const past=all.filter(item=>Date.parse(item.startsAt)<=now); const future=all.filter(item=>Date.parse(item.startsAt)>now).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.assignmentId.localeCompare(b.assignmentId));
    const offset=(historyPage-1)*WORKER_HISTORY_PAGE_SIZE;
    const detail:WorkerDetail={id:row.id,staffCode:row.staff_code,displayName:row.display_name,status:row.status,branchId:row.branch_id,branchName:row.branches.name,authLinked:Boolean(row.auth_profile_id),profileActive:row.profiles?.is_active??null,createdAt:row.created_at,updatedAt:row.updated_at,nextWork:future[0]??null,recentWork:past[0]??null,totalCompleted:all.filter(item=>item.assignmentStatus==="completed").length,absentCount:all.filter(item=>item.assignmentStatus==="absent").length,noShowCount:all.filter(item=>item.assignmentStatus==="no_show").length,history:all.slice(offset,offset+WORKER_HISTORY_PAGE_SIZE),historyTotal:all.length};
    return{ok:true as const,detail,canEdit:actor.status==="authenticated"&&actor.profile.account_type==="system_admin"};
  }catch(error){console.error("Failed to load admin worker detail",error);return{ok:false as const,reason:"error" as const};}
}
