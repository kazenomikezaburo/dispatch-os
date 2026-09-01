import type { ProjectFormInput } from "./project-form-schema";
import type { EditActionResult } from "@/lib/admin/edit/edit-action-result";

export type ProjectBranchOption = { id: string; name: string };
export type ProjectClientOption = { id: string; branchId: string; name: string };
export type ProjectFormOptions = { branches: ProjectBranchOption[]; clients: ProjectClientOption[] };
export type ProjectFormOptionsResult = { ok: true; options: ProjectFormOptions } | { ok: false };
export type ProjectCreateResult = { ok: false; message?: string; fieldErrors?: Partial<Record<keyof ProjectFormInput, string>> };
export type ProjectUpdateField = Exclude<keyof ProjectFormInput, "branch_id">;
export type ProjectUpdateResult = EditActionResult<ProjectUpdateField>;
