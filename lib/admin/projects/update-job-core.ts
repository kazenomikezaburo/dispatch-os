import "server-only";

import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/admin/projects/project-rules";
import { editConflictMessage, editGeneralErrorMessage } from "@/lib/admin/edit/edit-action-result";
import type { EditActor } from "@/lib/admin/edit/get-edit-actor";
import { createClient } from "@/lib/supabase/server";
import type { JobFormInput } from "./job-form-schema";
import type { JobUpdateResult } from "./job-form-types";
import type { JobUpdateInput } from "./job-update-schema";

type EditableField = keyof JobFormInput;
type CurrentJob = JobFormInput & {
  id: string;
  project_id: string;
  updated_at: string;
  projects: { branch_id: string };
};

const notFoundMessage = "業務が見つからないか、編集する権限がありません。";
type JobUpdateCoreResult = Exclude<JobUpdateResult, { ok: true }> | (Extract<JobUpdateResult, { ok: true }> & { projectId: string });

export async function updateJobCore(input: JobUpdateInput, actor: EditActor): Promise<JobUpdateCoreResult> {
  try {
    void actor;
    const supabase = await createClient();
    const currentResult = await supabase.from("jobs").select("id, project_id, workplace_id, name, status, description, hourly_wage, transportation_fee_cap, dress_code, requirements, meal_notes, recruitment_notes, manual_url, updated_at, projects!inner(branch_id)").eq("id", input.id).maybeSingle();
    if (currentResult.error) throw currentResult.error;
    if (!currentResult.data) return { ok: false, type: "not_found", message: notFoundMessage };

    const row = currentResult.data as unknown as CurrentJob;
    const current: JobFormInput = {
      name: row.name,
      workplace_id: row.workplace_id,
      status: row.status,
      description: row.description,
      hourly_wage: row.hourly_wage,
      transportation_fee_cap: row.transportation_fee_cap,
      dress_code: row.dress_code,
      requirements: row.requirements,
      meal_notes: row.meal_notes,
      recruitment_notes: row.recruitment_notes,
      manual_url: row.manual_url,
    };
    const values: JobFormInput = {
      name: input.name,
      workplace_id: input.workplace_id,
      status: input.status,
      description: input.description,
      hourly_wage: input.hourly_wage,
      transportation_fee_cap: input.transportation_fee_cap,
      dress_code: input.dress_code,
      requirements: input.requirements,
      meal_notes: input.meal_notes,
      recruitment_notes: input.recruitment_notes,
      manual_url: input.manual_url,
    };
    const unchanged = Object.entries(values).every(([key, value]) => current[key as EditableField] === value);
    if (unchanged) return { ok: true, type: "no_change", id: row.id, updatedAt: row.updated_at, projectId: row.project_id };
    if (row.updated_at !== input.expectedUpdatedAt) return { ok: false, type: "conflict", message: editConflictMessage };

    const workplaceChanged = values.workplace_id !== current.workplace_id;
    const compensationChanged = values.hourly_wage !== current.hourly_wage || values.transportation_fee_cap !== current.transportation_fee_cap;
    const [shiftsResult, workplaceResult] = await Promise.all([
      supabase.from("shift_slots").select("id").eq("job_id", row.id),
      workplaceChanged ? supabase.from("workplaces").select("id, branch_id").eq("id", values.workplace_id).eq("is_active", true).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (shiftsResult.error || workplaceResult.error) throw shiftsResult.error ?? workplaceResult.error;
    if (workplaceChanged && (!workplaceResult.data || workplaceResult.data.branch_id !== row.projects.branch_id)) {
      return { ok: false, type: "validation", message: "入力内容を確認してください。", fieldErrors: { workplace_id: "この案件の支店で利用できる勤務先を選択してください。" } };
    }
    if (workplaceChanged && (shiftsResult.data?.length ?? 0) > 0) {
      return { ok: false, type: "validation", message: "入力内容を確認してください。", fieldErrors: { workplace_id: "シフト作成後は勤務先を変更できません。" } };
    }

    if (compensationChanged && (shiftsResult.data?.length ?? 0) > 0) {
      const assignmentResult = await supabase.from("assignments").select("id").in("shift_slot_id", shiftsResult.data.map((shift) => shift.id)).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]).limit(1);
      if (assignmentResult.error) throw assignmentResult.error;
      if ((assignmentResult.data?.length ?? 0) > 0) {
        const fieldErrors: Partial<Record<EditableField, string>> = {};
        if (values.hourly_wage !== current.hourly_wage) fieldErrors.hourly_wage = "配置済みスタッフがいるため、時給は変更できません。";
        if (values.transportation_fee_cap !== current.transportation_fee_cap) fieldErrors.transportation_fee_cap = "配置済みスタッフがいるため、交通費上限は変更できません。";
        return { ok: false, type: "validation", message: "入力内容を確認してください。", fieldErrors };
      }
    }

    const updateResult = await supabase.from("jobs").update(values).eq("id", row.id).eq("updated_at", input.expectedUpdatedAt).select("id, updated_at");
    if (updateResult.error) throw updateResult.error;
    if (updateResult.data.length === 0) return { ok: false, type: "conflict", message: editConflictMessage };
    if (updateResult.data.length !== 1) throw new Error("Unexpected job update row count.");
    return { ok: true, type: "updated", id: updateResult.data[0].id, updatedAt: updateResult.data[0].updated_at, projectId: row.project_id };
  } catch (error: unknown) {
    console.error("Failed to update job", error);
    return { ok: false, type: "error", message: editGeneralErrorMessage };
  }
}
