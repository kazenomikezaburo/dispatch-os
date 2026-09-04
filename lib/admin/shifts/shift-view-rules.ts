import type { ShiftListItem, ShiftQuery } from "./shift-list-types";

export type ShiftView = "list" | "week" | "calendar";
export type ShiftViewState = { view: ShiftView; date: string; month: string; today: string };
export type ShiftDateRange = { start: string; end: string };
const DAY = 86_400_000;
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function tokyoDate(value: string | Date): string {
  const parts = dateFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

// Leave a year of arithmetic headroom at ISO's four-digit boundaries.
export function isShiftDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0100-01-01" || value > "9998-12-31") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseShiftView(value: Record<string, string | string[] | undefined>, now = new Date()): ShiftViewState {
  const first = (key: string) => { const raw = value[key]; return (Array.isArray(raw) ? raw[0] : raw) ?? ""; };
  const today = tokyoDate(now);
  const view = first("view") === "week" ? "week" : first("view") === "calendar" ? "calendar" : "list";
  const rawDate = first("date");
  const date = isShiftDate(rawDate) ? rawDate : view === "list" && !rawDate ? "" : today;
  const rawMonth = first("month");
  const month = /^\d{4}-\d{2}$/.test(rawMonth) && isShiftDate(`${rawMonth}-01`) ? rawMonth : today.slice(0, 7);
  return { view, date, month, today };
}

export function addDays(date: string, amount: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + amount * DAY).toISOString().split("T")[0];
}

export function weekDays(date: string): string[] {
  const offset = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(date, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function adjacentMonth(month: string, amount: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().split("T")[0].slice(0, 7);
}

export function calendarDays(month: string): string[] {
  const start = weekDays(`${month}-01`)[0];
  const last = addDays(`${adjacentMonth(month, 1)}-01`, -1);
  const length = Math.max(35, Math.ceil((new Date(`${last}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime() + DAY) / (7 * DAY)) * 7);
  return Array.from({ length }, (_, i) => addDays(start, i));
}

export function shiftViewDays(state: ShiftViewState): string[] {
  return state.view === "calendar" ? calendarDays(state.month) : state.view === "week" ? weekDays(state.date) : state.date ? [state.date] : [];
}

export function shiftViewRange(state: ShiftViewState): ShiftDateRange | undefined {
  const days = shiftViewDays(state);
  if (!days.length) return undefined;
  const midnight = (date: string) => new Date(`${date}T00:00:00+09:00`).toISOString();
  return { start: midnight(days[0]), end: midnight(addDays(days[days.length - 1], 1)) };
}

export function shiftViewHref(query: ShiftQuery, state: ShiftViewState, patch: Partial<Pick<ShiftViewState, "view" | "date" | "month">> = {}): string {
  const next = { ...state, ...patch };
  if (patch.view && patch.view !== state.view) {
    const anchor = state.view === "calendar" ? (state.month === state.today.slice(0, 7) ? state.today : `${state.month}-01`) : state.date || state.today;
    if (patch.view === "week" && patch.date === undefined) next.date = anchor;
    if (patch.view === "calendar" && patch.month === undefined) next.month = anchor.slice(0, 7);
    if (patch.view === "list" && patch.date === undefined) next.date = "";
  }
  const params = new URLSearchParams({ view: next.view });
  for (const [key, val] of Object.entries(query)) if (val) params.set(key, val);
  if (next.view === "calendar") params.set("month", next.month);
  else if (next.date) params.set("date", next.date);
  return `/admin/shifts?${params.toString()}`;
}

export function groupShiftsByDay(shifts: ShiftListItem[], days: string[]): Map<string, ShiftListItem[]> {
  const groups = new Map<string, ShiftListItem[]>(days.map((day) => [day, []]));
  for (const shift of shifts) groups.get(tokyoDate(shift.startsAt))?.push(shift);
  for (const rows of groups.values()) rows.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  return groups;
}

export function shiftDayLabel(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "UTC", month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${date}T00:00:00Z`));
}

export function shiftTimeLabel(shift: Pick<ShiftListItem, "startsAt" | "endsAt">): string {
  const endPrefix = tokyoDate(shift.startsAt) === tokyoDate(shift.endsAt) ? "" : `${shiftDayLabel(tokyoDate(shift.endsAt))} `;
  return `${timeFormatter.format(new Date(shift.startsAt))}–${endPrefix}${timeFormatter.format(new Date(shift.endsAt))}`;
}

export function calendarPreview(rows: ShiftListItem[]) {
  return { visible: rows.slice(0, 2), remaining: Math.max(0, rows.length - 2) };
}
