import { z } from "zod";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix in integration tests.
import { ADMIN_ATTENDANCE_STATES, type AttendanceQuery } from "./attendance-types.ts";

function firstValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
export function getTokyoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const schema = z.object({
  date: z.string().refine(isCalendarDate).catch(() => getTokyoDate()),
  state: z.enum(["all", ...ADMIN_ATTENDANCE_STATES]).catch("all"),
  confirmation: z.enum(["all", "unconfirmed", "confirmed", "corrected"]).catch("all"),
  attention: z.enum(["all", "needs_attention"]).catch("all"),
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});
export function parseAttendanceQuery(value: Record<string, string | string[] | undefined>): AttendanceQuery {
  return schema.parse({ date: firstValue(value.date) ?? getTokyoDate(), state: firstValue(value.state) ?? "all", confirmation: firstValue(value.confirmation) ?? "all", attention: firstValue(value.attention) ?? "all", q: firstValue(value.q) ?? "", page: firstValue(value.page) ?? "1" });
}
export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
export function getTokyoDateRange(value: string) {
  const start = new Date(`${value}T00:00:00+09:00`); return { start: start.toISOString(), end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString() };
}
