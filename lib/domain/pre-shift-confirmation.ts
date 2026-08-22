export type PreShiftConfirmationState = "not_open" | "pending" | "confirmed";

export function getPreShiftConfirmationOpenAt(startsAt: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startsAt));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(
    Date.UTC(value("year"), value("month") - 1, value("day") - 1)
      - 9 * 60 * 60 * 1000,
  );
}

export function getPreShiftConfirmationState({
  startsAt,
  hasConfirmation,
  now,
}: {
  startsAt: string;
  hasConfirmation: boolean;
  now: Date;
}): PreShiftConfirmationState {
  if (hasConfirmation) return "confirmed";
  return now.getTime() < getPreShiftConfirmationOpenAt(startsAt).getTime()
    ? "not_open"
    : "pending";
}
