"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { jobFormSchema, type JobFormValues } from "@/lib/admin/projects/job-form-schema";
import type { JobCreateFailure, JobCreateResult } from "@/lib/admin/projects/job-form-types";
import { uuidSchema } from "@/lib/utils/uuid-schema";
import { jobUpdateSchema, type JobUpdateInput } from "@/lib/admin/projects/job-update-schema";
import type { JobUpdateResult } from "@/lib/admin/projects/job-form-types";
import { updateJobCore } from "@/lib/admin/projects/update-job-core";
import { editForbiddenMessage } from "@/lib/admin/edit/edit-action-result";
import { getEditActor } from "@/lib/admin/edit/get-edit-actor";

const failure = (): JobCreateResult => ({ ok: false, message: "業務・勤務先を追加できませんでした。入力内容を確認して再度お試しください。" });

async function createJobCore(projectId: string, input: unknown): Promise<JobCreateResult> {
  if (!uuidSchema.safeParse(projectId).success) return failure();
  const parsed = jobFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: NonNullable<JobCreateFailure["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) { const field = issue.path[0]; if (typeof field === "string" && !(field in fieldErrors)) fieldErrors[field as keyof JobFormValues] = issue.message; }
    return { ok: false, fieldErrors };
  }
  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type === "worker") return failure();
  try {
    const supabase = await createClient();
    const [project, workplace] = await Promise.all([
      supabase.from("projects").select("id, branch_id").eq("id", projectId).maybeSingle(),
      supabase.from("workplaces").select("id, branch_id").eq("id", parsed.data.workplace_id).eq("is_active", true).maybeSingle(),
    ]);
    if (project.error || workplace.error || !project.data || !workplace.data || project.data.branch_id !== workplace.data.branch_id) return failure();
    const jobId = crypto.randomUUID();
    const result = await supabase.from("jobs").insert({ id: jobId, project_id: project.data.id, workplace_id: workplace.data.id, name: parsed.data.name, status: parsed.data.status, description: parsed.data.description, hourly_wage: parsed.data.hourly_wage, transportation_fee_cap: parsed.data.transportation_fee_cap, dress_code: parsed.data.dress_code, requirements: parsed.data.requirements, meal_notes: parsed.data.meal_notes, recruitment_notes: parsed.data.recruitment_notes, manual_url: parsed.data.manual_url });
    if (result.error) throw result.error;
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    return { ok: true, jobId };
  } catch (error: unknown) {
    console.error("Failed to create job", error);
    return failure();
  }
}

export async function createJob(projectId: string, input: unknown): Promise<JobCreateResult> {
  const result = await createJobCore(projectId, input);
  if (result.ok) redirect(`/admin/projects/${projectId}`);
  return result;
}

export async function createJobInline(projectId: string, input: unknown): Promise<JobCreateResult> {
  return createJobCore(projectId, input);
}

export async function updateJob(input: JobUpdateInput): Promise<JobUpdateResult> {
  const parsed = jobUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof JobFormValues, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && field !== "id" && field !== "expectedUpdatedAt" && !(field in fieldErrors)) fieldErrors[field as keyof JobFormValues] = issue.message;
    }
    return { ok: false, type: "validation", message: "入力内容を確認してください。", fieldErrors };
  }
  const actor = await getEditActor();
  if (!actor.ok) return { ok: false, type: "forbidden", message: editForbiddenMessage };
  const result = await updateJobCore(parsed.data, actor.actor);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${result.projectId}`);
    revalidatePath("/admin/shifts");
    return { ok: true, type: result.type, id: result.id, updatedAt: result.updatedAt };
  }
  return result;
}
