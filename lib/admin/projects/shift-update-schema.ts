import { z } from "zod";
import { editConcurrencySchema } from "@/lib/admin/edit/edit-concurrency";
import { shiftFormSchema } from "./shift-form-schema";

export const shiftUpdateSchema = editConcurrencySchema.extend(shiftFormSchema.shape);
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;

