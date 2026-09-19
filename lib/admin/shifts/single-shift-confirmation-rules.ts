// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { tokyoDate } from "./shift-view-rules.ts";

export type SingleShiftConfirmationPhase = "pre" | "day";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function resolveSingleShiftConfirmationPhase(value: string | string[] | undefined, shiftStartsAt: string, now = new Date()): { phase: SingleShiftConfirmationPhase; canonical: boolean } {
  const requested = first(value);
  if (requested === "pre" || requested === "day") return { phase: requested, canonical: true };
  return { phase: tokyoDate(now) < tokyoDate(shiftStartsAt) ? "pre" : "day", canonical: false };
}

export function singleShiftConfirmationHref(shiftId: string, phase: SingleShiftConfirmationPhase, assignmentId?: string) {
  const params = new URLSearchParams({ tab: "confirmation", phase });
  if (assignmentId) params.set("assignmentId", assignmentId);
  return `/admin/shifts/${encodeURIComponent(shiftId)}?${params.toString()}`;
}
