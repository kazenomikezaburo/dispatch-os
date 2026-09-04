import { isValidDateOnly } from "./bulk-shift-helpers";

// Date membership is separate from per-date field differences.
export function addShiftDates(current: readonly string[], added: readonly string[]) {
  return [...new Set([...current, ...added.filter(isValidDateOnly)])].sort();
}

export function initialShiftDates(date: string) {
  return isValidDateOnly(date) ? [date] : [];
}
