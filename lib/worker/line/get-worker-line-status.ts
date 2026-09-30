import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WorkerLineStatus } from "@/lib/line/types";

type RpcObject = Record<string, unknown>;

export async function getWorkerLineStatus(): Promise<WorkerLineStatus> {
  const supabase = await createClient();
  const result = await supabase.rpc("get_own_line_link_status");
  const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as RpcObject
    : null;
  if (result.error || data?.ok !== true) throw new Error("Worker LINE status unavailable");
  const status = data.status;
  if (status !== "unlinked" && status !== "linked_available" && status !== "linked_unavailable" && status !== "suspended") {
    throw new Error("Worker LINE status invalid");
  }
  return {
    linked: data.linked === true,
    status,
    externalRemindersEnabled: data.external_reminders_enabled === true,
    enabledAt: typeof data.enabled_at === "string" ? data.enabled_at : null,
    linkedAt: typeof data.linked_at === "string" ? data.linked_at : null,
  };
}
