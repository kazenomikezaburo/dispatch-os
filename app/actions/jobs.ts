"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { jobFormSchema, type JobFormValues } from "@/lib/admin/projects/job-form-schema";
import type { JobCreateResult } from "@/lib/admin/projects/job-form-types";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const failure = (): JobCreateResult => ({ ok: false, message: "業務・勤務先を追加できませんでした。入力内容を確認して再度お試しください。" });

export async function createJob(projectId: string, input: unknown): Promise<JobCreateResult> {
  if (!uuidSchema.safeParse(projectId).success) return failure();
  const parsed = jobFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: JobCreateResult["fieldErrors"] = {};
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
    redirect(`/admin/projects/${projectId}`);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    console.error("Failed to create job", error);
    return failure();
  }
}
