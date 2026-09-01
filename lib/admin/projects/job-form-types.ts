import type { JobFormValues } from "./job-form-schema";
import type { EditActionResult } from "@/lib/admin/edit/edit-action-result";
import type { ProjectStatus } from "./project-types";

export type JobWorkplaceOption = { id: string; name: string; address: string };
export type JobFormOptions = { project: { id: string; name: string; status: ProjectStatus }; workplaces: JobWorkplaceOption[] };
export type JobFormOptionsResult = { ok: true; options: JobFormOptions } | { ok: false; reason: "not_found" | "error" };
export type JobCreateFailure = { ok: false; message?: string; fieldErrors?: Partial<Record<keyof JobFormValues, string>> };
export type JobCreateResult = { ok: true; jobId: string } | JobCreateFailure;
export type JobUpdateResult = EditActionResult<keyof JobFormValues>;
