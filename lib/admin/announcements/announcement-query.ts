import type { AnnouncementFilter } from "./announcement-types";

export const ANNOUNCEMENT_PAGE_SIZE = 20;
export type AnnouncementQuery = { state: AnnouncementFilter; cursorAt: string | null; cursorId: string | null };

function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input; }
export function parseAnnouncementQuery(input: Record<string, string | string[] | undefined>): AnnouncementQuery {
  const rawState = value(input.state);
  const state: AnnouncementFilter = rawState === "draft" || rawState === "published" || rawState === "archived" ? rawState : "all";
  const cursorAt = value(input.cursorAt) ?? null;
  const cursorId = value(input.cursorId) ?? null;
  return { state, cursorAt: cursorAt && cursorId ? cursorAt : null, cursorId: cursorAt && cursorId ? cursorId : null };
}
export function announcementListHref(query: AnnouncementQuery, next?: { cursorAt: string; cursorId: string }) {
  const params = new URLSearchParams();
  if (query.state !== "all") params.set("state", query.state);
  if (next) { params.set("cursorAt", next.cursorAt); params.set("cursorId", next.cursorId); }
  const suffix = params.toString();
  return `/admin/announcements${suffix ? `?${suffix}` : ""}`;
}

