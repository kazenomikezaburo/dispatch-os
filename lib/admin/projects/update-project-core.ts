import "server-only";

import {
  editConflictMessage,
  editGeneralErrorMessage,
  type EditActionResult,
} from "@/lib/admin/edit/edit-action-result";
import type { EditActor } from "@/lib/admin/edit/get-edit-actor";
import { createClient } from "@/lib/supabase/server";
import type { ProjectEditableFormInput } from "./project-form-schema";
import type { ProjectUpdateInput } from "./project-update-schema";

type ProjectUpdateRow = ProjectEditableFormInput & {
  id: string;
  branch_id: string;
  updated_at: string;
};

type ProjectUpdateField = keyof ProjectEditableFormInput;
export type ProjectUpdateCoreResult = EditActionResult<ProjectUpdateField>;

const notFoundMessage = "案件が見つからないか、編集する権限がありません。";

export async function updateProjectCore(
  input: ProjectUpdateInput,
  actor: EditActor,
): Promise<ProjectUpdateCoreResult> {
  try {
    void actor;
    const supabase = await createClient();
    const currentResult = await supabase
      .from("projects")
      .select("id, branch_id, client_id, name, start_date, end_date, status, description, updated_at")
      .eq("id", input.id)
      .maybeSingle();

    if (currentResult.error) throw currentResult.error;
    if (!currentResult.data) {
      return { ok: false, type: "not_found", message: notFoundMessage };
    }

    const current = {
      ...currentResult.data,
      description: currentResult.data.description ?? "",
    } as ProjectUpdateRow;

    const clientResult = await supabase
      .from("clients")
      .select("id, branch_id")
      .eq("id", input.client_id)
      .maybeSingle();
    if (clientResult.error) throw clientResult.error;
    if (!clientResult.data || clientResult.data.branch_id !== current.branch_id) {
      return {
        ok: false,
        type: "validation",
        message: "入力内容を確認してください。",
        fieldErrors: { client_id: "この案件の支店で利用できる取引先を選択してください。" },
      };
    }

    const values: ProjectEditableFormInput = {
      name: input.name,
      client_id: input.client_id,
      start_date: input.start_date,
      end_date: input.end_date,
      status: input.status,
      description: input.description,
    };
    const unchanged = Object.entries(values).every(([key, value]) =>
      current[key as ProjectUpdateField] === value,
    );
    if (unchanged) {
      return { ok: true, type: "no_change", id: current.id, updatedAt: current.updated_at };
    }

    const updateResult = await supabase
      .from("projects")
      .update({ ...values, description: values.description || null })
      .eq("id", input.id)
      .eq("updated_at", input.expectedUpdatedAt)
      .select("id, updated_at");
    if (updateResult.error) throw updateResult.error;
    if (updateResult.data.length === 0) {
      return { ok: false, type: "conflict", message: editConflictMessage };
    }
    if (updateResult.data.length !== 1) throw new Error("Unexpected project update row count.");

    return {
      ok: true,
      type: "updated",
      id: updateResult.data[0].id,
      updatedAt: updateResult.data[0].updated_at,
    };
  } catch (error: unknown) {
    console.error("Failed to update project", error);
    return { ok: false, type: "error", message: editGeneralErrorMessage };
  }
}
