import { z } from "zod";
// @ts-expect-error Node native TypeScript integration tests require the suffix.
import { uuidSchema } from "../../utils/uuid-schema.ts";

const date = /^\d{4}-\d{2}-\d{2}$/;
const time = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
export const attendanceConfirmationSchema = z.object({
  assignmentId: uuidSchema,
  actualStartDate: z.string().regex(date),
  actualStartTime: z.string().regex(time),
  actualEndDate: z.string().regex(date),
  actualEndTime: z.string().regex(time),
  breakMinutes: z.string().trim().regex(/^\d+$/).refine((value) => Number(value) <= 32767),
  adjustmentReason: z.string().trim().max(1000),
}).superRefine((value, context) => {
  const start = tokyoLocalToIso(value.actualStartDate, value.actualStartTime);
  const end = tokyoLocalToIso(value.actualEndDate, value.actualEndTime);
  if (!start || !end || end <= start) context.addIssue({ code: "custom", path: ["actualEndTime"], message: "終了日時は開始日時より後にしてください。" });
  if (start && end && Number(value.breakMinutes) > (Date.parse(end) - Date.parse(start)) / 60_000) context.addIssue({ code: "custom", path: ["breakMinutes"], message: "休憩時間は勤務時間以内で入力してください。" });
});
export type AttendanceConfirmationInput = z.infer<typeof attendanceConfirmationSchema>;
export function tokyoLocalToIso(day: string, clock: string) {
  if (!date.test(day) || !time.test(clock)) return null;
  return new Date(`${day}T${clock.length === 5 ? `${clock}:00` : clock}+09:00`).toISOString();
}
