import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProjectFormOptionsResult } from "./project-form-types";

export async function getProjectFormOptions(): Promise<ProjectFormOptionsResult> {
  try {
    const supabase = await createClient();
    const [branches, clients] = await Promise.all([
      supabase.from("branches").select("id, name").order("name"),
      supabase.from("clients").select("id, branch_id, name").order("name"),
    ]);
    if (branches.error) throw branches.error;
    if (clients.error) throw clients.error;
    return { ok: true, options: { branches: branches.data ?? [], clients: (clients.data ?? []).map((client) => ({ id: client.id, branchId: client.branch_id, name: client.name })) } };
  } catch (error: unknown) {
    console.error("Failed to load project form options", error);
    return { ok: false };
  }
}
