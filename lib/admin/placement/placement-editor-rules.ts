import type { PlacementBreak, PlacementPlan, PlacementPosition, PlacementSegment } from "./placement-types";

export const toTimeValue = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
export function resolveShiftTime(time: string, plan: Pick<PlacementPlan, "startsAt" | "endsAt">) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const start = new Date(plan.startsAt);
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
  let instant = new Date(`${date}T${time}:00+09:00`);
  if (instant < start) instant = new Date(instant.getTime() + 86400000);
  return instant <= new Date(plan.endsAt) ? instant.toISOString() : null;
}
const overlaps = (a: { startAt: string; endAt: string }, b: { startAt: string; endAt: string }) => a.startAt < b.endAt && b.startAt < a.endAt;
export function validatePlacementDraft(plan: PlacementPlan): string[] {
  const errors: string[] = [];
  const active = plan.positions.filter((p) => !p.retired);
  if (active.some((p) => !p.label.trim())) errors.push("配置ポジション名を入力してください。");
  if (active.reduce((n, p) => n + (p.requiredWorkers ?? 0), 0) > plan.requiredWorkers) errors.push("ポジションの必要人数合計がシフト必要人数を超えています。");
  for (const assignment of plan.assignments) {
    const segments = plan.segments.filter((s) => s.assignmentId === assignment.assignmentId);
    const breaks = plan.breaks.filter((b) => b.assignmentId === assignment.assignmentId);
    if (segments.some((a, i) => segments.slice(i + 1).some((b) => overlaps(a, b)))) errors.push(`${assignment.worker?.name ?? "スタッフ"}の配置時間が重複しています。`);
    if (breaks.some((a, i) => breaks.slice(i + 1).some((b) => overlaps(a, b)))) errors.push(`${assignment.worker?.name ?? "スタッフ"}の休憩時間が重複しています。`);
    if (segments.some((s) => breaks.some((b) => overlaps(s, b)))) errors.push(`${assignment.worker?.name ?? "スタッフ"}の配置と休憩が重複しています。`);
  }
  if (plan.segments.some((s) => !active.some((p) => p.id === s.positionId))) errors.push("終了した配置枠を参照する配置があります。");
  return [...new Set(errors)];
}
export function plannedMinutes(rows: (PlacementSegment | PlacementBreak)[]) { return rows.reduce((n, row) => n + (Date.parse(row.endAt) - Date.parse(row.startAt)) / 60000, 0); }
export function positionCoverage(position: PlacementPosition, segments: PlacementSegment[], breaks: PlacementBreak[], bounds?: { startAt: string; endAt: string }) {
  const boundaryPoints = bounds ? [bounds.startAt, bounds.endAt] : [];
  const withinBounds = (instant: string) => !bounds || (bounds.startAt <= instant && instant <= bounds.endAt);
  const points = [...new Set(boundaryPoints.concat(segments.filter((s) => s.positionId === position.id).flatMap((s) => [s.startAt, s.endAt]), breaks.flatMap((b) => [b.startAt, b.endAt])).filter(withinBounds))].sort();
  return points.slice(0, -1).map((startAt, i) => { const endAt = points[i + 1]; const placed = new Set(segments.filter((s) => s.positionId === position.id && s.startAt < endAt && startAt < s.endAt && !breaks.some((b) => b.assignmentId === s.assignmentId && b.startAt < endAt && startAt < b.endAt)).map((s) => s.assignmentId)).size; return { startAt, endAt, placed, shortage: position.requiredWorkers == null ? null : Math.max(0, position.requiredWorkers - placed) }; });
}

type CoveragePlan = Pick<PlacementPlan, "startsAt" | "endsAt" | "positions" | "segments" | "breaks" | "assignments">;

export type PlacementCoverageBand = {
  position: PlacementPosition;
  startAt: string;
  endAt: string;
  required: number;
  covered: number;
  shortage: number;
};

export function placementCoverageBands(plan: CoveragePlan): PlacementCoverageBand[] {
  const activeAssignmentIds = new Set(plan.assignments.map((assignment) => assignment.assignmentId));
  const segments = plan.segments.filter((segment) => activeAssignmentIds.has(segment.assignmentId));
  const breaks = plan.breaks.filter((interval) => activeAssignmentIds.has(interval.assignmentId));
  return plan.positions.filter((position) => !position.retired && position.requiredWorkers !== null).flatMap((position) =>
    positionCoverage(position, segments, breaks, { startAt: plan.startsAt, endAt: plan.endsAt })
      .map((interval) => ({ position, startAt: interval.startAt, endAt: interval.endAt, required: position.requiredWorkers ?? 0, covered: interval.placed, shortage: interval.shortage ?? 0 }))
      .reduce<PlacementCoverageBand[]>((bands, interval) => {
        const previous = bands.at(-1);
        if (previous && previous.endAt === interval.startAt && previous.required === interval.required && previous.covered === interval.covered && previous.shortage === interval.shortage) {
          previous.endAt = interval.endAt;
          return bands;
        }
        bands.push(interval);
        return bands;
      }, []),
  );
}

export function placementCoverageShortages(plan: CoveragePlan) {
  return placementCoverageBands(plan).filter((interval) => interval.shortage > 0);
}

export function timelineGeometry(iso: string, startsAt: string, endsAt: string) {
  const duration = Date.parse(endsAt) - Date.parse(startsAt);
  return duration > 0 ? Math.min(100, Math.max(0, ((Date.parse(iso) - Date.parse(startsAt)) / duration) * 100)) : 0;
}

export function timelineMarkers(startsAt: string, endsAt: string) {
  const start = Date.parse(startsAt); const end = Date.parse(endsAt); const durationMinutes = (end - start) / 60000;
  const step = durationMinutes > 720 ? 120 : 60;
  const first = Math.ceil(start / (step * 60000)) * step * 60000;
  const instants = [start, ...Array.from({ length: Math.max(0, Math.floor((end - first) / (step * 60000)) + 1) }, (_, i) => first + i * step * 60000).filter((value) => value > start && value < end), end];
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  const startDay = day.format(new Date(start));
  return instants.map((instant) => ({ instant: new Date(instant).toISOString(), percent: timelineGeometry(new Date(instant).toISOString(), startsAt, endsAt), label: `${day.format(new Date(instant)) === startDay ? "" : "翌 "}${clock.format(new Date(instant))}` }));
}
