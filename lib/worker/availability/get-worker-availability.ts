import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AvailabilityInterval, AvailabilityKind, WorkerAvailabilityData } from "./types";

type IntervalRow = {
  id: string;
  kind: AvailabilityKind;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

type ConditionsRow = {
  preferred_iso_weekdays: number[] | null;
  preferred_start_local: string | null;
  preferred_end_local: string | null;
  preferred_ends_next_day: boolean;
  preferred_area_note: string | null;
  preferred_work_category_note: string | null;
  transport_preference_note: string | null;
  is_active: boolean;
};

function mapInterval(row: IntervalRow): AvailabilityInterval {
  return { id: row.id, kind: row.kind, startsAt: row.starts_at, endsAt: row.ends_at, createdAt: row.created_at };
}

function mapConditions(row: ConditionsRow | null): WorkerAvailabilityData["workConditions"] {
  if (!row) return null;
  return {
    preferredIsoWeekdays: row.preferred_iso_weekdays ?? [],
    preferredStartLocal: row.preferred_start_local?.slice(0, 5) ?? null,
    preferredEndLocal: row.preferred_end_local?.slice(0, 5) ?? null,
    preferredEndsNextDay: row.preferred_ends_next_day,
    preferredAreaNote: row.preferred_area_note,
    preferredWorkCategoryNote: row.preferred_work_category_note,
    transportPreferenceNote: row.transport_preference_note,
    isActive: row.is_active,
  };
}

export async function getOwnWorkerAvailability(): Promise<{ ok: true; data: WorkerAvailabilityData } | { ok: false }> {
  try {
    const supabase = await createClient();
    const worker = await supabase.from("workers").select("id").maybeSingle();
    if (worker.error || !worker.data) return { ok: false };
    const result = await getWorkerAvailability(worker.data.id);
    return result.ok ? result : { ok: false };
  } catch (error) {
    console.error("Failed to load own availability", error);
    return { ok: false };
  }
}

export async function getWorkerAvailability(workerId: string): Promise<{ ok: true; data: WorkerAvailabilityData } | { ok: false }> {
  try {
    const supabase = await createClient();
    const [intervals, conditions] = await Promise.all([
      supabase.from("worker_availability_intervals").select("id,kind,starts_at,ends_at,created_at").eq("worker_id", workerId).is("retired_at", null).order("starts_at").order("id"),
      supabase.from("worker_work_conditions").select("preferred_iso_weekdays,preferred_start_local,preferred_end_local,preferred_ends_next_day,preferred_area_note,preferred_work_category_note,transport_preference_note,is_active").eq("worker_id", workerId).maybeSingle(),
    ]);
    if (intervals.error || conditions.error) throw intervals.error ?? conditions.error;
    return {
      ok: true,
      data: {
        intervals: ((intervals.data ?? []) as IntervalRow[]).map(mapInterval),
        workConditions: mapConditions((conditions.data as ConditionsRow | null) ?? null),
      },
    };
  } catch (error) {
    console.error("Failed to load worker availability", error);
    return { ok: false };
  }
}
