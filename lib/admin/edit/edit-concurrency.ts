import { z } from "zod";

import { uuidSchema } from "@/lib/utils/uuid-schema";

/**
 * PostgreSQL timestamptzをData APIで往復させるための不透明な競合Token。
 * Dateへ変換せず、検証済み文字列をそのまま.eq("updated_at", token)へ渡す。
 */
export const expectedUpdatedAtSchema = z.string().datetime({ offset: true });

export const editConcurrencySchema = z.object({
  id: uuidSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export type EditConcurrencyInput = z.infer<typeof editConcurrencySchema>;

