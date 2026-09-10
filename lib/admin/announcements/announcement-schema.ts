import { z } from "zod";
import { uuidSchema } from "@/lib/utils/uuid-schema";
import { ANNOUNCEMENT_IMPORTANCE, ANNOUNCEMENT_SCOPES } from "./announcement-types";

const idempotencyKey = z.string().trim().min(1).max(128);
export const announcementIdSchema = uuidSchema;
export const announcementDraftSchema = z.object({
  announcementId: announcementIdSchema.optional(),
  expectedVersion: z.number().int().positive().optional(),
  scopeType: z.enum(ANNOUNCEMENT_SCOPES),
  branchId: uuidSchema.nullable(),
  title: z.string().trim().max(120),
  body: z.string().trim().max(5000),
  importance: z.enum(ANNOUNCEMENT_IMPORTANCE),
  idempotencyKey,
}).superRefine((value, context) => {
  if (value.scopeType === "organization" && value.branchId !== null) context.addIssue({ code: "custom", path: ["branchId"], message: "全Workerでは拠点を指定できません。" });
  if (value.scopeType === "branch" && value.branchId === null) context.addIssue({ code: "custom", path: ["branchId"], message: "拠点を選択してください。" });
});
export const announcementTransitionSchema = z.object({
  announcementId: announcementIdSchema,
  expectedVersion: z.number().int().positive(),
  idempotencyKey,
});
export type AnnouncementDraftInput = z.input<typeof announcementDraftSchema>;
export type AnnouncementTransitionInput = z.input<typeof announcementTransitionSchema>;
