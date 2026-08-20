import { z } from "zod";
import { PROJECT_STATUSES, type ProjectQuery } from "./project-types";

function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const querySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["all", ...PROJECT_STATUSES]).catch("all"),
  period: z.enum(["all", "upcoming", "this_month", "past"]).catch("all"),
});

export function parseProjectQuery(
  value: Record<string, string | string[] | undefined>,
): ProjectQuery {
  return querySchema.parse({
    q: firstValue(value.q) ?? "",
    status: firstValue(value.status) ?? "all",
    period: firstValue(value.period) ?? "all",
  });
}
