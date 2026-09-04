import { z } from "zod";
export const PAGE_SIZE=20;
const first=(value:string|string[]|undefined)=>(Array.isArray(value)?value[0]:value)??"";
export function parseMasterQuery(raw:Record<string,string|string[]|undefined>){const status=first(raw.status);const page=Number(first(raw.page));return {q:first(raw.q).trim().slice(0,100),status:status==="active"||status==="inactive"?status:"all",page:Number.isSafeInteger(page)&&page>0?page:1} as const;}
const blankToNull=(value:string|undefined)=>value?.trim()||null;
export const clientSchema=z.object({branchId:z.string().min(1),name:z.string().trim().min(1,"取引先名を入力してください。").max(100),note:z.string().max(2000).optional().transform(blankToNull),isActive:z.boolean()});
export const workplaceSchema=z.object({branchId:z.string().min(1),name:z.string().trim().min(1,"勤務先名を入力してください。").max(100),postalCode:z.string().max(20).optional().transform(blankToNull),address:z.string().trim().min(1,"住所を入力してください。").max(500),defaultTransportNote:z.string().max(1000).optional().transform(blankToNull),accessNote:z.string().max(1000).optional().transform(blankToNull),meetingNote:z.string().max(1000).optional().transform(blankToNull),isActive:z.boolean()});
export const masterUpdateSchema=z.object({id:z.string().min(1),expectedUpdatedAt:z.string().min(1)});
export function pageCount(total:number){return Math.max(1,Math.ceil(total/PAGE_SIZE));}
export function masterHref(path:string,query:{q:string;status:string;page:number},patch:Partial<{q:string;status:string;page:number}>={}){const next={...query,...patch};const p=new URLSearchParams();if(next.q)p.set("q",next.q);if(next.status!=="all")p.set("status",next.status);if(next.page>1)p.set("page",String(next.page));const suffix=p.toString();return suffix?`${path}?${suffix}`:path;}
