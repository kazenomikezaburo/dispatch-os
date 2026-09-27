import { z } from "zod";
import { uuidSchema } from "../utils/uuid-schema";

export const HEALTH_STATUSES = ["good", "concern", "unwell"] as const;
const tokyoLocal = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export const preShiftConfirmationSchema = z.object({
  assignmentId: uuidSchema,
  canWork: z.boolean(),
  healthStatus: z.enum(HEALTH_STATUSES),
  plannedWakeAt: z.string().regex(tokyoLocal).or(z.literal("")),
  plannedDepartureAt: z.string().regex(tokyoLocal).or(z.literal("")),
}).superRefine((value, context) => {
  const wake = tokyoLocalToIso(value.plannedWakeAt);
  const departure = tokyoLocalToIso(value.plannedDepartureAt);
  if (wake && departure && departure < wake) context.addIssue({ code: "custom", path: ["plannedDepartureAt"], message: "出発予定は起床予定以降にしてください。" });
});

export type PreShiftConfirmationInput = z.infer<typeof preShiftConfirmationSchema>;
export type HealthStatus = PreShiftConfirmationInput["healthStatus"];

export function tokyoLocalToIso(value: string) {
  if (!value) return null;
  if (!tokyoLocal.test(value)) return null;
  return new Date(`${value}:00+09:00`).toISOString();
}
