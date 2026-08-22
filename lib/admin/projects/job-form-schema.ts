import { z } from "zod";
import { uuidSchema } from "../../utils/uuid-schema";

export const JOB_STATUSES = ["draft", "recruiting", "closed", "confirmed", "in_progress", "completed", "cancelled"] as const;
const optionalText = (maximum: number) => z.union([z.string(), z.null()]).transform((value) => value?.trim() || null).refine((value) => value === null || value.length <= maximum, `${maximum}文字以内で入力してください。`);
const optionalInteger = (label: string) => z.union([z.string(), z.number(), z.null()]).refine((value) => value === null || value === "" || (typeof value === "number" ? Number.isInteger(value) && value >= 0 : /^\d+$/.test(value.trim())), `${label}は0以上の整数で入力してください。`).transform((value) => value === null || value === "" ? null : Number(value));
const optionalUrl = z.union([z.string(), z.null()]).transform((value) => value?.trim() || null).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}, "有効なURLを入力してください。");

export const jobFormSchema = z.object({
  name: z.string().trim().min(1, "業務名を入力してください。").max(100, "業務名は100文字以内で入力してください。"),
  workplace_id: uuidSchema,
  status: z.enum(JOB_STATUSES),
  description: optionalText(2000),
  hourly_wage: optionalInteger("時給"),
  transportation_fee_cap: optionalInteger("交通費上限"),
  dress_code: optionalText(2000),
  requirements: optionalText(2000),
  meal_notes: optionalText(2000),
  recruitment_notes: optionalText(2000),
  manual_url: optionalUrl,
});

export type JobFormValues = z.input<typeof jobFormSchema>;
export type JobFormInput = z.output<typeof jobFormSchema>;
