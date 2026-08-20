"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { projectFormSchema, type ProjectFormInput } from "@/lib/admin/projects/project-form-schema";
import type { ProjectCreateResult } from "@/lib/admin/projects/project-form-types";

const failure = (): ProjectCreateResult => ({ ok: false, message: "案件を作成できませんでした。入力内容を確認して再度お試しください。" });

export async function createProject(input: ProjectFormInput): Promise<ProjectCreateResult> {
  const parsed = projectFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: ProjectCreateResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) fieldErrors[field as keyof ProjectFormInput] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type === "worker") return failure();

  try {
    const supabase = await createClient();
    const [branch, client] = await Promise.all([
      supabase.from("branches").select("id").eq("id", parsed.data.branch_id).maybeSingle(),
      supabase.from("clients").select("id, branch_id").eq("id", parsed.data.client_id).maybeSingle(),
    ]);
    if (branch.error || client.error || !branch.data || !client.data || client.data.branch_id !== branch.data.id) return failure();

    const result = await supabase.from("projects").insert({
      name: parsed.data.name,
      branch_id: branch.data.id,
      client_id: client.data.id,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      status: parsed.data.status,
      description: parsed.data.description || null,
      created_by: auth.profile.id,
    }).select("id").single();
    if (result.error) throw result.error;
    revalidatePath("/admin/projects");
    redirect(`/admin/projects/${result.data.id}`);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    console.error("Failed to create project", error);
    return failure();
  }
}
