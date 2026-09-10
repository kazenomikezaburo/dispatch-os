import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WorkerAnnouncementCursor, WorkerAnnouncementDetail, WorkerAnnouncementImportance, WorkerAnnouncementPage, WorkerAnnouncementSummary } from "./worker-announcement-types";

const PAGE_SIZE = 20;
type SummaryRow = {announcement_id:string;title:string;importance:WorkerAnnouncementImportance;published_at:string};
type DetailRow = SummaryRow & {body:string};
type ListResponse = {ok:boolean;code?:string;items?:SummaryRow[]};
type DetailResponse = {ok:boolean;code?:string;announcement?:DetailRow};

function summary(row:SummaryRow):WorkerAnnouncementSummary{return{id:row.announcement_id,title:row.title,importance:row.importance,publishedAt:row.published_at};}

export async function getWorkerAnnouncements(cursor:WorkerAnnouncementCursor|null=null):Promise<{ok:true;page:WorkerAnnouncementPage}|{ok:false;reason:"unavailable"}> {
  const supabase=await createClient();
  const response=await supabase.rpc("list_worker_announcements",{p_limit:PAGE_SIZE+1,p_cursor_published_at:cursor?.publishedAt??null,p_cursor_id:cursor?.id??null});
  if(response.error)throw response.error;
  const data=response.data as ListResponse;
  if(!data.ok)return{ok:false,reason:"unavailable"};
  const rows=data.items??[];const visible=rows.slice(0,PAGE_SIZE);const last=visible.at(-1);
  return{ok:true,page:{announcements:visible.map(summary),nextCursor:rows.length>PAGE_SIZE&&last?{publishedAt:last.published_at,id:last.announcement_id}:null}};
}

export async function getWorkerAnnouncement(announcementId:string):Promise<{ok:true;announcement:WorkerAnnouncementDetail}|{ok:false;reason:"unavailable"}> {
  const supabase=await createClient();const response=await supabase.rpc("get_worker_announcement",{p_announcement_id:announcementId});
  if(response.error)throw response.error;const data=response.data as DetailResponse;
  if(!data.ok||!data.announcement)return{ok:false,reason:"unavailable"};
  return{ok:true,announcement:{...summary(data.announcement),body:data.announcement.body}};
}
