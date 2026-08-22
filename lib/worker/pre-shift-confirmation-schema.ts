import { z } from "zod";
import { uuidSchema } from "../utils/uuid-schema";

export const HEALTH_STATUSES = ["good", "concern", "unwell"] as const;

export const preShiftConfirmationSchema = z.object({
  assignmentId: uuidSchema,
  canWork: z.boolean(),
  healthStatus: z.enum(HEALTH_STATUSES),
});

export type PreShiftConfirmationInput = z.infer<typeof preShiftConfirmationSchema>;
export type HealthStatus = PreShiftConfirmationInput["healthStatus"];
