import type { ProjectStatus } from "./project-types";
import type { JobStatus } from "./project-detail-types";
import type { ShiftFormValues } from "./shift-form-schema";

export type ShiftFormOptions = { project: { id: string; name: string; status: ProjectStatus }; job: { id: string; name: string; status: JobStatus; workplaceName: string; hourlyWage: number | null; transportationFeeCap: number | null } };
export type ShiftFormOptionsResult = { ok: true; options: ShiftFormOptions } | { ok: false; reason: "not_found" | "error" };
export type ShiftCreateResult = { ok: false; message?: string; fieldErrors?: Partial<Record<keyof ShiftFormValues, string>> };
