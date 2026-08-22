import { z } from "zod";
import { uuidSchema } from "../utils/uuid-schema";

export const workerAttendanceSchema = z.object({
  assignmentId: uuidSchema,
});

export type WorkerAttendanceInput = z.infer<typeof workerAttendanceSchema>;
