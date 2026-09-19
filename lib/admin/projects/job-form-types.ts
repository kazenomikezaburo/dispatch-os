import type { JobFormValues } from "./job-form-schema";
import type { EditActionResult } from "@/lib/admin/edit/edit-action-result";
import type { ProjectStatus } from "./project-types";
import type { WorkplaceItem } from "@/lib/admin/masters/master-types";

export type JobWorkplaceOption = WorkplaceItem;
export type JobFormOptions = { project: { id: string; name: string; status: ProjectStatus; branchId: string }; workplaces: JobWorkplaceOption[] };
export type JobFormOptionsResult = { ok: true; options: JobFormOptions } | { ok: false; reason: "not_found" | "error" };
export type JobCreateFailure = { ok: false; message?: string; fieldErrors?: Partial<Record<keyof JobFormValues, string>> };
export type JobCreateResult = { ok: true; jobId: string } | JobCreateFailure;
export type JobUpdateResult = EditActionResult<keyof JobFormValues>;
