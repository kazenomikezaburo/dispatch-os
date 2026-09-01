import type { ShiftStatus } from "./project-detail-types";

export type BulkShiftConfig = {
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  requiredWorkers: string;
  breakMinutes: string;
  deadlineEnabled: boolean;
  deadlineDaysBefore: string;
  deadlineTime: string;
  status: ShiftStatus;
};

export type BulkShiftOverride = Partial<BulkShiftConfig>;
export type BulkShiftOverrides = Record<string, BulkShiftOverride>;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string) {
  return datePattern.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function generateDates(start: string, end: string, weekdays: number[]) {
  if (!isValidDateOnly(start) || !isValidDateOnly(end) || start > end) return [];
  const selected = new Set(weekdays);
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  const result: string[] = [];
  while (cursor <= last) {
    if (selected.has(cursor.getUTCDay())) result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function resolveShiftConfig(base: BulkShiftConfig, override?: BulkShiftOverride): BulkShiftConfig {
  return { ...base, ...override };
}

export function normalizeOverride(base: BulkShiftConfig, candidate: BulkShiftConfig): BulkShiftOverride {
  return Object.fromEntries(
    (Object.keys(base) as (keyof BulkShiftConfig)[])
      .filter((key) => base[key] !== candidate[key])
      .map((key) => [key, candidate[key]]),
  ) as BulkShiftOverride;
}

