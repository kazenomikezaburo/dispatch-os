"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { announcementDraftSchema, announcementTransitionSchema, type AnnouncementDraftInput, type AnnouncementTransitionInput } from "@/lib/admin/announcements/announcement-schema";
import { createClient } from "@/lib/supabase/server";

export type AnnouncementActionResult = {ok:true;announcementId:string;version?:number}|{ok:false;type:"validation"|"conflict"|"forbidden"|"not_found"|"error";message:string;refresh:boolean;fieldErrors?:Record<string,string|undefined>};
type RpcResult={ok?:boolean;code?:string;announcement_id?:string;version?:number};
function failure(code:string|undefined):Extract<AnnouncementActionResult,{ok:false}>{
  if(code==="VERSION_CONFLICT"||code==="STATE_CONFLICT")return{ok:false,type:"conflict",message:"このお知らせは別の操作で更新されています。最新の内容を読み込み直してください。",refresh:true};
  if(code==="EMPTY_AUDIENCE")return{ok:false,type:"validation",message:"現在、この公開対象に該当するWorkerがいません。",refresh:false};
  if(code==="NOT_FOUND")return{ok:false,type:"not_found",message:"このお知らせを表示または操作できません。",refresh:true};
  if(code==="FORBIDDEN")return{ok:false,type:"forbidden",message:"この操作を行う権限がありません。",refresh:false};
  if(code==="INVALID_INPUT")return{ok:false,type:"validation",message:"入力内容を確認してください。",refresh:false};
  if(code==="IDEMPOTENCY_CONFLICT")return{ok:false,type:"conflict",message:"操作内容が競合しました。最新の内容を読み込んでから再度お試しください。",refresh:true};
  return{ok:false,type:"error",message:"操作を完了できませんでした。時間をおいて再度お試しください。",refresh:false};
}
function fieldErrors(error:{flatten:()=>{fieldErrors:Record<string,string[]>}}){const entries=Object.entries(error.flatten().fieldErrors).map(([key,messages])=>[key,messages[0]]);return Object.fromEntries(entries);}
async function call(name:string,args:Record<string,unknown>,projectAfterPublish=false):Promise<AnnouncementActionResult>{
  await requireAdmin();
  try{const supabase=await createClient();const response=await supabase.rpc(name,args);if(response.error)throw response.error;const data=response.data as RpcResult;if(!data.ok)return failure(data.code);if(projectAfterPublish&&data.announcement_id){try{const projection=await supabase.rpc("project_announcement_in_app_notifications",{p_announcement_id:data.announcement_id});const projected=projection.data as RpcResult;if(projection.error||!projected?.ok)console.error("Failed to project published Announcement notifications",projection.error??projected?.code);}catch(projectionError:unknown){console.error("Failed to project published Announcement notifications",projectionError);}}revalidatePath("/admin/announcements");revalidatePath("/worker");revalidatePath("/worker/notifications");if(data.announcement_id)revalidatePath(`/admin/announcements/${data.announcement_id}`);return{ok:true,announcementId:data.announcement_id??String(args.p_announcement_id),version:data.version};}
  catch(error){console.error(`Failed Announcement command: ${name}`,error);return failure(undefined);}
}
export async function createAnnouncementDraft(input:AnnouncementDraftInput):Promise<AnnouncementActionResult>{const parsed=announcementDraftSchema.safeParse(input);if(!parsed.success)return{ok:false,type:"validation",message:"入力内容を確認してください。",refresh:false,fieldErrors:fieldErrors(parsed.error)};return call("create_announcement_draft",{p_scope_type:parsed.data.scopeType,p_branch_id:parsed.data.branchId,p_title:parsed.data.title,p_body:parsed.data.body,p_importance:parsed.data.importance,p_idempotency_key:parsed.data.idempotencyKey});}
export async function updateAnnouncementDraft(input:AnnouncementDraftInput):Promise<AnnouncementActionResult>{const parsed=announcementDraftSchema.safeParse(input);if(!parsed.success||!parsed.data.announcementId||!parsed.data.expectedVersion)return{ok:false,type:"validation",message:"入力内容を確認してください。",refresh:false,fieldErrors:parsed.success?undefined:fieldErrors(parsed.error)};return call("update_announcement_draft",{p_announcement_id:parsed.data.announcementId,p_expected_version:parsed.data.expectedVersion,p_scope_type:parsed.data.scopeType,p_branch_id:parsed.data.branchId,p_title:parsed.data.title,p_body:parsed.data.body,p_importance:parsed.data.importance,p_idempotency_key:parsed.data.idempotencyKey});}
export async function publishAnnouncement(input:AnnouncementTransitionInput){const parsed=announcementTransitionSchema.safeParse(input);if(!parsed.success)return failure("INVALID_INPUT");return call("publish_announcement",{p_announcement_id:parsed.data.announcementId,p_expected_version:parsed.data.expectedVersion,p_idempotency_key:parsed.data.idempotencyKey},true);}
export async function archiveAnnouncement(input:AnnouncementTransitionInput){const parsed=announcementTransitionSchema.safeParse(input);if(!parsed.success)return failure("INVALID_INPUT");return call("archive_announcement",{p_announcement_id:parsed.data.announcementId,p_expected_version:parsed.data.expectedVersion,p_idempotency_key:parsed.data.idempotencyKey});}
export async function deleteAnnouncementDraft(input:AnnouncementTransitionInput){const parsed=announcementTransitionSchema.safeParse(input);if(!parsed.success)return failure("INVALID_INPUT");return call("delete_announcement_draft",{p_announcement_id:parsed.data.announcementId,p_expected_version:parsed.data.expectedVersion,p_idempotency_key:parsed.data.idempotencyKey});}
