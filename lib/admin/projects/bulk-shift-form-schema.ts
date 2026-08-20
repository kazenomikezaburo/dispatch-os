import { z } from "zod";
import { SHIFT_STATUSES, tokyoLocalToIso } from "./shift-form-schema";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = (value: string) =>
  datePattern.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const integerString = (minimum: number, message: string) =>
  z.string().trim().refine(
    (value) => /^\d+$/.test(value) && Number(value) >= minimum,
    message,
  );

export const bulkShiftFormSchema = z
  .object({
    dates: z
      .array(z.string().refine(validDate, "有効な勤務日を追加してください。"))
      .min(1, "勤務日を1日以上追加してください。")
      .max(31, "勤務日は31日以内で選択してください。"),
    startTime: z.string().regex(timePattern, "開始時刻を入力してください。"),
    endTime: z.string().regex(timePattern, "終了時刻を入力してください。"),
    endsNextDay: z.boolean(),
    requiredWorkers: integerString(
      1,
      "必要人数は1名以上の整数で入力してください。",
    ),
    breakMinutes: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^\d+$/.test(value),
        "休憩時間は0以上の整数で入力してください。",
      ),
    deadlineEnabled: z.boolean(),
    deadlineDaysBefore: z.string(),
    deadlineTime: z.string(),
    status: z.enum(SHIFT_STATUSES),
  })
  .superRefine((value, context) => {
    if (new Set(value.dates).size !== value.dates.length) {
      context.addIssue({
        code: "custom",
        path: ["dates"],
        message: "同じ勤務日が重複しています。",
      });
    }

    if (
      value.deadlineEnabled &&
      (!/^\d+$/.test(value.deadlineDaysBefore) ||
        Number(value.deadlineDaysBefore) < 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deadlineDaysBefore"],
        message: "応募締切の日数は0以上の整数で入力してください。",
      });
    }
    if (value.deadlineEnabled && !timePattern.test(value.deadlineTime)) {
      context.addIssue({
        code: "custom",
        path: ["deadlineTime"],
        message: "有効な応募締切時刻を入力してください。",
      });
    }

    if (!timePattern.test(value.startTime) || !timePattern.test(value.endTime)) {
      return;
    }

    for (const date of value.dates) {
      const schedule = buildBulkShiftSchedule(
        date,
        value.startTime,
        value.endTime,
        value.endsNextDay,
        value.deadlineEnabled,
        Number(value.deadlineDaysBefore),
        value.deadlineTime,
      );
      if (!schedule || schedule.endsAt <= schedule.startsAt) {
        context.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "終了日時は開始日時より後にしてください。",
        });
        break;
      }
      if (
        schedule.applicationDeadline &&
        schedule.applicationDeadline > schedule.startsAt
      ) {
        context.addIssue({
          code: "custom",
          path: ["deadlineTime"],
          message: "応募締切が勤務開始後になっています。",
        });
        break;
      }
    }
  });

export type BulkShiftFormValues = z.infer<typeof bulkShiftFormSchema>;

export function addDaysToDate(date: string, days: number): string | null {
  if (!validDate(date) || !Number.isInteger(days)) return null;
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildBulkShiftSchedule(
  date: string,
  startTime: string,
  endTime: string,
  endsNextDay: boolean,
  deadlineEnabled: boolean,
  deadlineDaysBefore: number,
  deadlineTime: string,
) {
  const endDate = addDaysToDate(date, endsNextDay ? 1 : 0);
  const deadlineDate = deadlineEnabled
    ? addDaysToDate(date, -deadlineDaysBefore)
    : null;
  const startsAt = tokyoLocalToIso(date, startTime);
  const endsAt = endDate ? tokyoLocalToIso(endDate, endTime) : null;
  const applicationDeadline = deadlineEnabled
    ? deadlineDate && tokyoLocalToIso(deadlineDate, deadlineTime)
    : null;
  if (!startsAt || !endsAt || (deadlineEnabled && !applicationDeadline)) {
    return null;
  }
  return { startsAt, endsAt, applicationDeadline };
}
