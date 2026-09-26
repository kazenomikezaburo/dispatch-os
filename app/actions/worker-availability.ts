"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/require-worker";
import { createClient } from "@/lib/supabase/server";

const kindSchema = z.enum(["available", "consultable", "unavailable"]);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const intervalSchema = z.object({ kind: kindSchema, startsAtLocal: localDateTime, endsAtLocal: localDateTime });
const correctionSchema = intervalSchema.extend({ intervalId: z.string().uuid() });
const conditionsSchema = z.object({
  preferredIsoWeekdays: z.array(z.number().int().min(1).max(7)).max(7),
  preferredStartLocal: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  preferredEndLocal: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  preferredEndsNextDay: z.boolean(),
  preferredAreaNote: z.string().trim().max(500).nullable(),
  preferredWorkCategoryNote: z.string().trim().max(500).nullable(),
  transportPreferenceNote: z.string().trim().max(500).nullable(),
});

export type WorkerAvailabilityActionResult = { ok: true } | { ok: false; type: "validation" | "overlap" | "unavailable" | "error"; message: string };

function toTokyoInstant(value: string) {
  const instant = new Date(`${value}:00+09:00`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

function failure(error: { code?: string; message?: string }): WorkerAvailabilityActionResult {
  if (error.code === "23P01") return { ok: false, type: "overlap", message: "既存の勤務可能時間と重複しています。隣接する時間は登録できます。" };
  if (error.code === "42501" || error.code === "P0002") return { ok: false, type: "unavailable", message: "対象が見つからないか、操作できません。" };
  if (error.code === "23514" || error.code === "22007") return { ok: false, type: "validation", message: "日時または希望条件を確認してください。" };
  console.error("Worker availability RPC failed", error);
  return { ok: false, type: "error", message: "勤務条件を更新できませんでした。" };
}

function refresh() {
  revalidatePath("/worker/availability");
  revalidatePath("/admin/workers");
}

export async function createOwnAvailability(input: unknown): Promise<WorkerAvailabilityActionResult> {
  await requireWorker();
  const parsed = intervalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, type: "validation", message: "日時と状態を入力してください。" };
  const startsAt = toTokyoInstant(parsed.data.startsAtLocal);
  const endsAt = toTokyoInstant(parsed.data.endsAtLocal);
  if (!startsAt || !endsAt || startsAt >= endsAt) return { ok: false, type: "validation", message: "終了日時は開始日時より後にしてください。" };
  const supabase = await createClient();
  const result = await supabase.rpc("create_own_availability_interval", { p_kind: parsed.data.kind, p_starts_at: startsAt, p_ends_at: endsAt });
  if (result.error) return failure(result.error);
  refresh();
  return { ok: true };
}

export async function correctOwnAvailability(input: unknown): Promise<WorkerAvailabilityActionResult> {
  await requireWorker();
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, type: "validation", message: "修正内容を確認してください。" };
  const startsAt = toTokyoInstant(parsed.data.startsAtLocal);
  const endsAt = toTokyoInstant(parsed.data.endsAtLocal);
  if (!startsAt || !endsAt || startsAt >= endsAt) return { ok: false, type: "validation", message: "終了日時は開始日時より後にしてください。" };
  const supabase = await createClient();
  const result = await supabase.rpc("correct_own_availability_interval", { p_interval_id: parsed.data.intervalId, p_kind: parsed.data.kind, p_starts_at: startsAt, p_ends_at: endsAt });
  if (result.error) return failure(result.error);
  refresh();
  return { ok: true };
}

export async function retireOwnAvailability(intervalId: unknown): Promise<WorkerAvailabilityActionResult> {
  await requireWorker();
  const parsed = z.string().uuid().safeParse(intervalId);
  if (!parsed.success) return { ok: false, type: "validation", message: "対象を確認してください。" };
  const supabase = await createClient();
  const result = await supabase.rpc("retire_own_availability_interval", { p_interval_id: parsed.data });
  if (result.error) return failure(result.error);
  refresh();
  return { ok: true };
}

export async function setOwnWorkConditions(input: unknown): Promise<WorkerAvailabilityActionResult> {
  await requireWorker();
  const parsed = conditionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, type: "validation", message: "希望条件を確認してください。" };
  const hasStart = parsed.data.preferredStartLocal !== null;
  const hasEnd = parsed.data.preferredEndLocal !== null;
  if (hasStart !== hasEnd) return { ok: false, type: "validation", message: "希望開始・終了時刻は両方入力してください。" };
  const supabase = await createClient();
  const result = await supabase.rpc("set_own_work_conditions", {
    p_preferred_iso_weekdays: parsed.data.preferredIsoWeekdays.length ? parsed.data.preferredIsoWeekdays : null,
    p_preferred_start_local: parsed.data.preferredStartLocal,
    p_preferred_end_local: parsed.data.preferredEndLocal,
    p_preferred_ends_next_day: parsed.data.preferredEndsNextDay,
    p_preferred_area_note: parsed.data.preferredAreaNote || null,
    p_preferred_work_category_note: parsed.data.preferredWorkCategoryNote || null,
    p_transport_preference_note: parsed.data.transportPreferenceNote || null,
    p_is_active: true,
  });
  if (result.error) return failure(result.error);
  refresh();
  return { ok: true };
}
