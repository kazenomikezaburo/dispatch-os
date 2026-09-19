import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProjectFormOptionsResult } from "./project-form-types";

export type ProjectSetupWorkplaceOption = { id: string; branchId: string; name: string; address: string };
export type ProjectSetupOptionsResult = ProjectFormOptionsResult & { workplaces?: ProjectSetupWorkplaceOption[] };

export async function getProjectFormOptions(): Promise<ProjectSetupOptionsResult> {
  try {
    const supabase = await createClient();
    const [branches, clients, workplaces] = await Promise.all([
      supabase.from("branches").select("id, name").order("name"),
      supabase.from("clients").select("id, branch_id, name").order("name"),
      supabase.from("workplaces").select("id, branch_id, name, address").eq("is_active", true).order("name"),
    ]);
    if (branches.error) throw branches.error;
    if (clients.error) throw clients.error;
    if (workplaces.error) throw workplaces.error;
    return { ok: true, options: { branches: branches.data ?? [], clients: (clients.data ?? []).map((client) => ({ id: client.id, branchId: client.branch_id, name: client.name })) }, workplaces: (workplaces.data ?? []).map((workplace) => ({ id: workplace.id, branchId: workplace.branch_id, name: workplace.name, address: workplace.address })) };
  } catch (error: unknown) {
    console.error("Failed to load project form options", error);
    return { ok: false };
  }
}
