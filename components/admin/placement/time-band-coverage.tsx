import { placementCoverageBands, timelineMarkers } from "@/lib/admin/placement/placement-editor-rules";
import type { PlacementPlan } from "@/lib/admin/placement/placement-types";

export function TimeBandCoverage({ plan, headingAs = "h2", headingId = "time-band-coverage-heading" }: { plan: PlacementPlan; headingAs?: "h2" | "h3"; headingId?: string }) {
  const Heading = headingAs;
  const bands = placementCoverageBands(plan);
  const activePositions = plan.positions.filter((position) => !position.retired);
  const configuredPositions = new Set(bands.map((band) => band.position.id)).size;
  const shortageBands = bands.filter((band) => band.shortage > 0);
  const labelByInstant = new Map(timelineMarkers(plan.startsAt, plan.endsAt).map((marker) => [marker.instant, marker.label]));
  const timeLabel = (instant: string) => labelByInstant.get(instant) ?? timeBandTimeLabel(instant, plan.startsAt);

  return <section aria-labelledby={headingId} className="rounded-panel border border-border bg-surface p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Heading id={headingId} className={headingAs === "h2" ? "text-lg font-semibold" : "font-semibold"}>時間帯別Coverage</Heading>
        <p className="mt-1 text-sm text-foreground-muted">配置と休憩から、Shift内の必要人数・Coverage・不足を導出します。</p>
      </div>
      {bands.length > 0 && <p className={`rounded-full px-3 py-1 text-xs font-semibold ${shortageBands.length > 0 ? "bg-danger-subtle text-danger-foreground" : "bg-success-subtle text-success-foreground"}`}>{shortageBands.length > 0 ? `不足 ${shortageBands.length}時間帯` : "全時間帯を充足"}</p>}
    </div>

    {activePositions.length === 0 ? <p className="mt-4 rounded-control bg-surface-subtle p-4 text-sm text-foreground-muted">配置ポジションは未設定です。</p>
      : configuredPositions === 0 ? <p className="mt-4 rounded-control bg-surface-subtle p-4 text-sm text-foreground-muted">必要人数が設定されたポジションはありません。</p>
        : <ul className="mt-4 space-y-2" aria-label="時間帯別Coverage一覧">{bands.map((band) => {
          const shortage = band.shortage > 0;
          return <li key={`${band.position.id}:${band.startAt}:${band.endAt}`} className={`rounded-card border p-3 sm:grid sm:grid-cols-[minmax(8rem,1fr)_minmax(9rem,1fr)_5rem_5rem_5rem_6rem] sm:items-center sm:gap-3 ${shortage ? "border-danger/40 bg-danger-subtle" : "border-border bg-surface-subtle"}`}>
            <p className="min-w-0 truncate text-sm font-semibold">{band.position.label || "名称未入力"}</p>
            <p className="mt-1 text-sm font-medium tabular-nums sm:mt-0">{timeLabel(band.startAt)}–{timeLabel(band.endAt)}</p>
            <CoverageValue label="必要" value={band.required} />
            <CoverageValue label="Coverage" value={band.covered} />
            <CoverageValue label="不足" value={band.shortage} emphasized={shortage} />
            <p className={`mt-2 text-right text-xs font-semibold sm:mt-0 ${shortage ? "text-danger" : "text-success"}`}>{shortage ? `${band.shortage}名不足` : "充足"}</p>
          </li>;
        })}</ul>}
  </section>;
}

function CoverageValue({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return <p className={`mt-2 inline-flex w-1/3 flex-col text-xs sm:mt-0 sm:inline-flex sm:w-auto ${emphasized ? "font-semibold text-danger" : "text-foreground-muted"}`}><span>{label}</span><span className="mt-0.5 text-sm tabular-nums text-foreground">{value}名</span></p>;
}

function timeBandTimeLabel(instant: string, shiftStart: string) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day.format(new Date(instant)) === day.format(new Date(shiftStart)) ? "" : "翌 "}${clock.format(new Date(instant))}`;
}
