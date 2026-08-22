import { z } from "zod";
import { tokyoLocalToIso } from "./attendance-confirmation-schema";

export const attendanceRevisionSchema = z.object({
  assignmentId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  actualStartDate: z.string(),
  actualStartTime: z.string(),
  actualEndDate: z.string(),
  actualEndTime: z.string(),
  breakMinutes: z.string().trim().regex(/^\d+$/, "休憩時間を入力してください。").refine((value) => Number(value) <= 32767, "休憩時間を確認してください。"),
  reason: z.string().trim().min(1, "訂正理由を入力してください。").max(500, "訂正理由は500文字以内で入力してください。"),
}).superRefine((value, context) => {
  const start = tokyoLocalToIso(value.actualStartDate, value.actualStartTime);
  const end = tokyoLocalToIso(value.actualEndDate, value.actualEndTime);
  if (!start || !end || end <= start) context.addIssue({ code: "custom", path: ["actualEndTime"], message: "終了日時は開始日時より後にしてください。" });
  if (start && end && Number(value.breakMinutes) > (Date.parse(end) - Date.parse(start)) / 60_000) context.addIssue({ code: "custom", path: ["breakMinutes"], message: "休憩時間は勤務時間以内で入力してください。" });
});

export type AttendanceRevisionInput = z.infer<typeof attendanceRevisionSchema>;
