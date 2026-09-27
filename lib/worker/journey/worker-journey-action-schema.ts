import { z } from "zod";
import { uuidSchema } from "@/lib/utils/uuid-schema";
import { JOURNEY_TYPES } from "./worker-journey";

export const workerJourneyActionSchema = z.object({
  assignmentId: uuidSchema,
  journeyType: z.enum(JOURNEY_TYPES),
  idempotencyKey: z.string().uuid(),
});

export type WorkerJourneyActionInput = z.infer<typeof workerJourneyActionSchema>;
