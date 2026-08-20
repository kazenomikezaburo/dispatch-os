import { z } from "zod";
import { PROJECT_STATUSES } from "./project-types";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "選択内容が不正です。");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "有効な日付を入力してください。").refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "有効な日付を入力してください。");

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "案件名を入力してください。").max(100, "案件名は100文字以内で入力してください。"),
  branch_id: uuid,
  client_id: uuid,
  start_date: date,
  end_date: date,
  status: z.enum(PROJECT_STATUSES),
  description: z.string().trim().max(2000, "説明は2000文字以内で入力してください。"),
}).superRefine((value, context) => {
  if (value.end_date < value.start_date) context.addIssue({ code: "custom", path: ["end_date"], message: "終了日は開始日以降にしてください。" });
});

export type ProjectFormInput = z.infer<typeof projectFormSchema>;
