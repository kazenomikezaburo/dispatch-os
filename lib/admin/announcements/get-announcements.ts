import "server-only";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { ANNOUNCEMENT_PAGE_SIZE, type AnnouncementQuery } from "./announcement-query";
import type { AdminAnnouncement, AnnouncementActor, AnnouncementImportance, AnnouncementScope, AnnouncementState } from "./announcement-types";

type RpcItem = { announcement_id:string;state:AnnouncementState;version:number;scope_type:AnnouncementScope;branch_id:string|null;branch_name:string|null;title:string;body:string;importance:AnnouncementImportance;created_at:string;published_at:string|null;archived_at:string|null;recipient_count:number };
type ListRpc = { ok?:boolean;code?:string;items?:RpcItem[] };
type DetailRpc = { ok?:boolean;code?:string;announcement?:RpcItem };
function map(row: RpcItem): AdminAnnouncement { return { id:row.announcement_id,state:row.state,version:Number(row.version),scopeType:row.scope_type,branchId:row.branch_id,branchName:row.branch_name,title:row.title,body:row.body,importance:row.importance,createdAt:row.created_at,publishedAt:row.published_at,archivedAt:row.archived_at,recipientCount:Number(row.recipient_count) }; }

export async function getAnnouncementActor(): Promise<{ok:true;actor:AnnouncementActor}|{ok:false}> {
  const profile=await requireAdmin();
  try { const supabase=await createClient(); const branches=await supabase.from("branches").select("id,name").eq("is_active",true).order("name"); if(branches.error)throw branches.error; return {ok:true,actor:{accountType:profile.account_type === "system_admin" ? "system_admin" : "manager",branches:branches.data??[]}}; }
  catch(error){console.error("Failed to load Announcement form context",error);return{ok:false};}
}
export async function getAdminAnnouncements(query: AnnouncementQuery) {
  await requireAdmin();
  try { const supabase=await createClient(); const response=await supabase.rpc("list_admin_announcements",{p_limit:ANNOUNCEMENT_PAGE_SIZE+1,p_cursor_at:query.cursorAt,p_cursor_id:query.cursorId,p_state:query.state==="all"?null:query.state}); if(response.error)throw response.error; const data=response.data as ListRpc; if(!data.ok)throw new Error(data.code??"READ_FAILED"); const mapped=(data.items??[]).map(map); return{ok:true as const,items:mapped.slice(0,ANNOUNCEMENT_PAGE_SIZE),hasNext:mapped.length>ANNOUNCEMENT_PAGE_SIZE}; }
  catch(error){console.error("Failed to load Admin Announcements",error);return{ok:false as const};}
}
export async function getAdminAnnouncement(id:string) {
  await requireAdmin();
  try { const supabase=await createClient(); const response=await supabase.rpc("get_admin_announcement",{p_announcement_id:id}); if(response.error)throw response.error; const data=response.data as DetailRpc; if(!data.ok||!data.announcement)return data.code==="NOT_FOUND"?{ok:false as const,reason:"not_found" as const}:{ok:false as const,reason:"error" as const}; return{ok:true as const,announcement:map(data.announcement)}; }
  catch(error){console.error("Failed to load Admin Announcement",error);return{ok:false as const,reason:"error" as const};}
}

