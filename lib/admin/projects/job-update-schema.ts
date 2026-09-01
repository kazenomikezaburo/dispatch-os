import { z } from "zod";
import { editConcurrencySchema } from "@/lib/admin/edit/edit-concurrency";
import { jobFormSchema } from "./job-form-schema";

export const jobUpdateSchema = z.intersection(editConcurrencySchema, jobFormSchema);
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
