// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { deriveAdminAttendance } from "../attendance/attendance-rules.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { addDays, isShiftDate, tokyoDate } from "../shifts/shift-view-rules.ts";

export type DayOfFilter = "all" | "attention" | "scheduled" | "working" | "finished";
export type DayOfQuery = { date:string; q:string; project:string; state:DayOfFilter; assignment:string };
export type DayOfInput = {
  assignmentId:string; assignmentStatus:string; workerId:string; workerName:string; staffCode:string;
  shiftId:string; startsAt:string; endsAt:string; requiredWorkers:number; projectId:string; projectName:string;
  jobId:string; jobName:string; workplaceName:string; startWorkAt:string|null; endWorkAt:string|null;
  preShift:null|{canWork:boolean;submittedAt:string}; placements:{position:string;startAt:string;endAt:string}[];
  breaks:{startAt:string;endAt:string}[]; attendanceConfirmed:boolean;
};
export type DayOfItem = DayOfInput & ReturnType<typeof deriveAdminAttendance> & { attentionReason:string|null };

const first=(value:string|string[]|undefined)=>(Array.isArray(value)?value[0]:value)??"";
export function parseDayOfQuery(raw:Record<string,string|string[]|undefined>,now=new Date()):DayOfQuery {
  const date=first(raw.date); const state=first(raw.state);
  return {date:isShiftDate(date)?date:tokyoDate(now),q:first(raw.q).trim().slice(0,100),project:first(raw.project),state:(["attention","scheduled","working","finished"].includes(state)?state:"all") as DayOfFilter,assignment:first(raw.assignment)};
}
export function dayOfRange(date:string){return {start:new Date(`${date}T00:00:00+09:00`).toISOString(),end:new Date(`${addDays(date,1)}T00:00:00+09:00`).toISOString()};}
export function dayOfHref(query:DayOfQuery,patch:Partial<DayOfQuery>={}){const next={...query,...patch};const p=new URLSearchParams({date:next.date});if(next.q)p.set("q",next.q);if(next.project)p.set("project",next.project);if(next.state!=="all")p.set("state",next.state);if(next.assignment)p.set("assignment",next.assignment);return `/admin/day-of?${p}`;}
export function buildDayOfItems(inputs:DayOfInput[],query:DayOfQuery,now=new Date()):DayOfItem[]{
  const items=inputs.map((input)=>{const attendance=deriveAdminAttendance({id:input.assignmentId,shiftId:input.shiftId,status:input.assignmentStatus,workerName:input.workerName,startsAt:input.startsAt,endsAt:input.endsAt,projectName:input.projectName,jobName:input.jobName,workplaceName:input.workplaceName,startWorkAt:input.startWorkAt,endWorkAt:input.endWorkAt},now,input.attendanceConfirmed?"confirmed":"unconfirmed");
    const attentionReason=attendance.state==="no_show"?"無断欠勤":attendance.state==="absent"?"欠勤":attendance.state==="start_missing"?"開始未報告":attendance.lateMinutes>0?`開始 ${attendance.lateMinutes}分遅れ`:attendance.earlyLeaveMinutes>0?`予定より ${attendance.earlyLeaveMinutes}分早く終了`:input.preShift?.canWork===false?"前日確認で勤務不可":null;
    return {...input,...attendance,attentionReason};});
  const needle=query.q.toLocaleLowerCase("ja"); const matchState=(item:DayOfItem)=>query.state==="all"||(query.state==="attention"?Boolean(item.attentionReason):query.state==="scheduled"?(item.state==="scheduled"||item.state==="start_missing"):item.state===query.state);
  return items.filter((item)=>(!needle||[item.workerName,item.staffCode,item.projectName,item.jobName,item.workplaceName].some(v=>v.toLocaleLowerCase("ja").includes(needle)))&&(!query.project||item.projectId===query.project)&&matchState(item)).sort((a,b)=>Number(!a.attentionReason)-Number(!b.attentionReason)||a.startsAt.localeCompare(b.startsAt)||a.workerName.localeCompare(b.workerName,"ja")||a.assignmentId.localeCompare(b.assignmentId));
}
export function operationalLabel(item:Pick<DayOfItem,"state"|"lateMinutes">){if(item.state==="scheduled")return"勤務前";if(item.state==="start_missing")return"開始未報告";if(item.state==="working")return item.lateMinutes>0?`勤務中（開始 ${item.lateMinutes}分遅れ）`:"勤務中";if(item.state==="finished")return"勤務終了";if(item.state==="absent")return"欠勤";return"無断欠勤";}
export function placementLabel(item:Pick<DayOfItem,"placements">,date:string,now=new Date()){const current=item.placements.find(s=>Date.parse(s.startAt)<=now.getTime()&&now.getTime()<Date.parse(s.endAt));return {prefix:date===tokyoDate(now)&&current?"現在配置":"配置",value:current?.position??item.placements[0]?.position??null};}
export function plannedBreakLabel(item:Pick<DayOfItem,"breaks">,date:string,now=new Date()){const current=item.breaks.find(b=>Date.parse(b.startAt)<=now.getTime()&&now.getTime()<Date.parse(b.endAt));return date===tokyoDate(now)&&current?"予定休憩中":"予定休憩";}
