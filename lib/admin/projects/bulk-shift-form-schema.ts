import { z } from "zod";
import { SHIFT_STATUSES, tokyoLocalToIso } from "./shift-form-schema";
import { isValidDateOnly } from "./bulk-shift-helpers";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const integerString = (minimum: number, message: string) => z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= minimum, message);

export const bulkResolvedShiftSchema = z.object({
  date: z.string().refine(isValidDateOnly, "有効な勤務日を指定してください。"),
  startTime: z.string().regex(timePattern, "開始時刻を入力してください。"),
  endTime: z.string().regex(timePattern, "終了時刻を入力してください。"),
  endsNextDay: z.boolean(),
  requiredWorkers: integerString(1, "必要人数は1名以上の整数で入力してください。"),
  breakMinutes: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), "休憩時間は0以上の整数で入力してください。"),
  deadlineEnabled: z.boolean(),
  deadlineDaysBefore: z.string(),
  deadlineTime: z.string(),
  status: z.enum(SHIFT_STATUSES),
}).superRefine((value, context) => {
  if (value.deadlineEnabled && (!/^\d+$/.test(value.deadlineDaysBefore) || Number(value.deadlineDaysBefore) < 0)) context.addIssue({ code: "custom", path: ["deadlineDaysBefore"], message: "応募締切の日数は0以上の整数で入力してください。" });
  if (value.deadlineEnabled && !timePattern.test(value.deadlineTime)) context.addIssue({ code: "custom", path: ["deadlineTime"], message: "有効な応募締切時刻を入力してください。" });
  const schedule = buildBulkShiftSchedule(value.date, value.startTime, value.endTime, value.endsNextDay, value.deadlineEnabled, Number(value.deadlineDaysBefore), value.deadlineTime);
  if (!schedule || schedule.endsAt <= schedule.startsAt) context.addIssue({ code: "custom", path: ["endTime"], message: "終了日時は開始日時より後にしてください。" });
  if (schedule?.applicationDeadline && schedule.applicationDeadline > schedule.startsAt) context.addIssue({ code: "custom", path: ["deadlineTime"], message: "応募締切が勤務開始後になっています。" });
  if (schedule && value.breakMinutes !== "" && Number(value.breakMinutes) > (new Date(schedule.endsAt).getTime() - new Date(schedule.startsAt).getTime()) / 60000) context.addIssue({ code: "custom", path: ["breakMinutes"], message: "休憩時間は勤務時間以内で入力してください。" });
});

export const bulkShiftFormSchema = z.object({ shifts: z.array(bulkResolvedShiftSchema).min(1, "勤務日を1日以上追加してください。") }).superRefine((value, context) => {
  const dates = value.shifts.map((shift) => shift.date);
  if (new Set(dates).size !== dates.length) context.addIssue({ code: "custom", path: ["shifts"], message: "同じ勤務日が重複しています。" });
});

export type BulkResolvedShiftInput = z.infer<typeof bulkResolvedShiftSchema>;
export type BulkShiftFormValues = z.infer<typeof bulkShiftFormSchema>;

export function addDaysToDate(date: string, days: number): string | null {
  if (!isValidDateOnly(date) || !Number.isInteger(days)) return null;
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildBulkShiftSchedule(date: string, startTime: string, endTime: string, endsNextDay: boolean, deadlineEnabled: boolean, deadlineDaysBefore: number, deadlineTime: string) {
  const endDate = addDaysToDate(date, endsNextDay ? 1 : 0);
  const deadlineDate = deadlineEnabled ? addDaysToDate(date, -deadlineDaysBefore) : null;
  const startsAt = tokyoLocalToIso(date, startTime);
  const endsAt = endDate ? tokyoLocalToIso(endDate, endTime) : null;
  const applicationDeadline = deadlineEnabled ? deadlineDate && tokyoLocalToIso(deadlineDate, deadlineTime) : null;
  if (!startsAt || !endsAt || (deadlineEnabled && !applicationDeadline)) return null;
  return { startsAt, endsAt, applicationDeadline };
}
