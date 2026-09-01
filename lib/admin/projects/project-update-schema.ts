import { z } from "zod";
import { editConcurrencySchema } from "@/lib/admin/edit/edit-concurrency";
import { projectEditableFormSchema } from "./project-form-schema";

export const projectUpdateSchema = z.intersection(
  editConcurrencySchema,
  projectEditableFormSchema,
);

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
