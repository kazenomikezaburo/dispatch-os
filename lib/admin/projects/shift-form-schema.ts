import { z } from "zod";

export const SHIFT_STATUSES = ["draft", "recruiting", "closed", "confirmed", "in_progress", "completed", "cancelled"] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = (value: string) => datePattern.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const integerString = (minimum: number, message: string) => z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= minimum, message);

export const shiftFormSchema = z.object({
  start_date: z.string().refine(validDate, "開始日を入力してください。"),
  start_time: z.string().regex(timePattern, "開始時刻を入力してください。"),
  end_date: z.string().refine(validDate, "終了日を入力してください。"),
  end_time: z.string().regex(timePattern, "終了時刻を入力してください。"),
  required_workers: integerString(1, "必要人数は1名以上の整数で入力してください。"),
  break_minutes: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), "休憩時間は0以上の整数で入力してください。"),
  deadline_date: z.string().refine((value) => value === "" || validDate(value), "有効な応募締切日を入力してください。"),
  deadline_time: z.string().refine((value) => value === "" || timePattern.test(value), "有効な応募締切時刻を入力してください。"),
  status: z.enum(SHIFT_STATUSES),
}).superRefine((value, context) => {
  const startsAt = tokyoLocalToIso(value.start_date, value.start_time);
  const endsAt = tokyoLocalToIso(value.end_date, value.end_time);
  if (startsAt && endsAt && endsAt <= startsAt) context.addIssue({ code: "custom", path: ["end_time"], message: "終了日時は開始日時より後にしてください。" });
  if (Boolean(value.deadline_date) !== Boolean(value.deadline_time)) context.addIssue({ code: "custom", path: [value.deadline_date ? "deadline_time" : "deadline_date"], message: "応募締切の日付と時刻を両方入力してください。" });
  const deadline = value.deadline_date && value.deadline_time ? tokyoLocalToIso(value.deadline_date, value.deadline_time) : null;
  if (startsAt && deadline && deadline > startsAt) context.addIssue({ code: "custom", path: ["deadline_time"], message: "応募締切は勤務開始以前にしてください。" });
});

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;

export function tokyoLocalToIso(date: string, time: string) {
  if (!validDate(date) || !timePattern.test(time)) return null;
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}
