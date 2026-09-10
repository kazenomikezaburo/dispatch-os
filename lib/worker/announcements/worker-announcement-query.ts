import { uuidSchema } from "@/lib/utils/uuid-schema";
import type { WorkerAnnouncementCursor } from "./worker-announcement-types";

export function parseWorkerAnnouncementCursor(query:Record<string,string|string[]|undefined>):WorkerAnnouncementCursor|null{
  const publishedAt=typeof query.publishedAt==="string"?query.publishedAt:"";const id=typeof query.cursorId==="string"?query.cursorId:"";
  if(!publishedAt||!id||Number.isNaN(Date.parse(publishedAt))||!uuidSchema.safeParse(id).success)return null;
  return{publishedAt,id};
}

export function workerAnnouncementPageUrl(cursor:WorkerAnnouncementCursor){const query=new URLSearchParams({publishedAt:cursor.publishedAt,cursorId:cursor.id});return`/worker/announcements?${query.toString()}`;}
