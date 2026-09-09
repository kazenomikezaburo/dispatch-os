import { z } from "zod";
export const adminIncidentTransitionSchema=z.object({incidentId:z.string().uuid(),expectedVersion:z.number().int().min(1),idempotencyKey:z.string().trim().min(1).max(128)});
export type AdminIncidentTransitionInput=z.infer<typeof adminIncidentTransitionSchema>;
