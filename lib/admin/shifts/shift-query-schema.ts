import { z } from "zod";
import { SHIFT_STATUSES } from "@/lib/admin/projects/shift-form-schema";
import {
  SHIFT_PERIODS,
  STAFFING_FILTERS,
  type ShiftQuery,
} from "./shift-list-types";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const querySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  period: z.enum(SHIFT_PERIODS).catch("upcoming"),
  status: z.enum(["all", ...SHIFT_STATUSES]).catch("all"),
  staffing: z.enum(STAFFING_FILTERS).catch("all"),
});

export function parseShiftQuery(
  value: Record<string, string | string[] | undefined>,
): ShiftQuery {
  return querySchema.parse({
    q: firstValue(value.q) ?? "",
    period: firstValue(value.period) ?? "upcoming",
    status: firstValue(value.status) ?? "all",
    staffing: firstValue(value.staffing) ?? "all",
  });
}
