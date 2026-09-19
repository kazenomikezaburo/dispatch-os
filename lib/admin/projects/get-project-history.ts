import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ProjectHistoryCursor,
  ProjectHistoryEvent,
  ProjectHistoryEventType,
  ProjectHistoryPage,
  ProjectHistoryTargetType,
} from "./project-history-types";

export const PROJECT_HISTORY_PAGE_SIZE = 20;

type RpcItem = {
  id: number;
  created_at: string;
  actor_display_name: string;
  event_type: ProjectHistoryEventType;
  target_type: ProjectHistoryTargetType;
  target_id: string;
  target_label: string;
  payload: Record<string, unknown>;
};

type RpcPage = {
  items?: RpcItem[];
  next_cursor?: { created_at: string; id: number } | null;
};

function mapEvent(item: RpcItem): ProjectHistoryEvent {
  return {
    id: Number(item.id),
    createdAt: item.created_at,
    actorDisplayName: item.actor_display_name,
    eventType: item.event_type,
    targetType: item.target_type,
    targetId: item.target_id,
    targetLabel: item.target_label,
    payload: item.payload,
  };
}

export async function getProjectHistory(
  projectId: string,
  cursor: ProjectHistoryCursor | null = null,
): Promise<{ ok: true; page: ProjectHistoryPage } | { ok: false }> {
  try {
    const supabase = await createClient();
    const response = await supabase.rpc("list_project_history_events", {
      p_project_id: projectId,
      p_limit: PROJECT_HISTORY_PAGE_SIZE,
      p_before_created_at: cursor?.createdAt ?? null,
      p_before_id: cursor?.id ?? null,
    });
    if (response.error) throw response.error;

    const data = response.data as RpcPage;
    return {
      ok: true,
      page: {
        items: (data.items ?? []).map(mapEvent),
        nextCursor: data.next_cursor
          ? { createdAt: data.next_cursor.created_at, id: Number(data.next_cursor.id) }
          : null,
      },
    };
  } catch (error: unknown) {
    console.error("Failed to load Project history", error);
    return { ok: false };
  }
}
