import { z } from "zod";
import { uuidSchema } from "@/lib/utils/uuid-schema";
import { OPERATIONAL_INCIDENT_CATEGORIES } from "./worker-incident-ui";

export const createOperationalIncidentSchema = z.object({
  assignmentId: uuidSchema,
  category: z.enum(OPERATIONAL_INCIDENT_CATEGORIES),
  message: z.string().max(500).optional().default(""),
  idempotencyKey: z.string().trim().min(1).max(128),
});

export const retractOperationalIncidentSchema = z.object({
  incidentId: uuidSchema,
  assignmentId: uuidSchema,
  expectedVersion: z.number().int().min(1),
  idempotencyKey: z.string().trim().min(1).max(128),
});

export type CreateOperationalIncidentInput = z.infer<typeof createOperationalIncidentSchema>;
export type RetractOperationalIncidentInput = z.infer<typeof retractOperationalIncidentSchema>;
