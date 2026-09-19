"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { editConflictMessage, editForbiddenMessage, editGeneralErrorMessage } from "@/lib/admin/edit/edit-action-result";
import { masterUpdateSchema, workplaceSchema } from "@/lib/admin/masters/master-rules";
import type { MasterActionResult } from "@/lib/admin/masters/master-types";

const schema = workplaceSchema.and(masterUpdateSchema).and(z.object({ projectId: z.string().uuid(), jobId: z.string().uuid() }));
const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) => Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message]));

export async function updateProjectContextWorkplace(input: unknown): Promise<MasterActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, type: "validation", message: "入力内容を確認してください。", fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_project_context_workplace", {
      p_project_id: parsed.data.projectId, p_job_id: parsed.data.jobId, p_workplace_id: parsed.data.id,
      p_expected_updated_at: parsed.data.expectedUpdatedAt, p_name: parsed.data.name,
      p_postal_code: parsed.data.postalCode, p_address: parsed.data.address,
      p_default_transport_note: parsed.data.defaultTransportNote, p_access_note: parsed.data.accessNote,
      p_meeting_note: parsed.data.meetingNote, p_is_active: parsed.data.isActive,
    });
    if (error) {
      if (error.message.includes("WORKPLACE_UPDATE_CONFLICT")) return { ok: false, type: "conflict", message: editConflictMessage };
      if (error.message.includes("WORKPLACE_CONTEXT_UNAVAILABLE")) return { ok: false, type: "forbidden", message: editForbiddenMessage };
      throw error;
    }
    const result = data as { id: string; updated_at: string; outcome: "updated" | "no_change" };
    revalidatePath(`/admin/projects/${parsed.data.projectId}`);
    revalidatePath("/admin/projects");
    revalidatePath("/admin/workplaces");
    return { ok: true, type: result.outcome, id: result.id, updatedAt: result.updated_at };
  } catch (error) {
    console.error("Failed to update project-context workplace", error);
    return { ok: false, type: "error", message: editGeneralErrorMessage };
  }
}
