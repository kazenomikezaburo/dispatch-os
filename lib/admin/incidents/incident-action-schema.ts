import { z } from "zod";
import { uuidSchema } from "@/lib/utils/uuid-schema";
export const adminIncidentTransitionSchema=z.object({incidentId:uuidSchema,expectedVersion:z.number().int().min(1),idempotencyKey:z.string().trim().min(1).max(128)});
export type AdminIncidentTransitionInput=z.infer<typeof adminIncidentTransitionSchema>;
