"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import type { PlacementSaveInput, PlacementSaveResult } from "@/lib/admin/placement/placement-types";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const uuid = uuidSchema; const iso = z.string().datetime({ offset: true });
const schema = z.object({ shiftId: uuid, version: z.number().int().nonnegative(), idempotencyKey: z.string().trim().min(1).max(128), reason: z.string().trim().max(500),
  positions: z.array(z.object({ id: uuid, label: z.string().trim().min(1).max(200), requiredWorkers: z.number().int().nonnegative().nullable(), displayOrder: z.number().int().nonnegative(), retired: z.boolean() })).max(100),
  segments: z.array(z.object({ id: uuid, assignmentId: uuid, positionId: uuid, startAt: iso, endAt: iso })).max(1000),
  breaks: z.array(z.object({ id: uuid, assignmentId: uuid, startAt: iso, endAt: iso })).max(1000),
});
const messages: Record<string, string> = { VERSION_CONFLICT: "別の画面で更新されました。最新の配置を読み込んでください。", IDEMPOTENCY_CONFLICT: "同じ保存操作の内容が一致しません。再度保存してください。", OVERLAP: "配置または休憩の時間が重複しています。", INVALID_TIME_RANGE: "時間はシフト範囲内で開始より終了を後にしてください。", REQUIREMENT_EXCEEDED: "ポジションの必要人数合計がシフト必要人数を超えています。", CORRECTION_REASON_REQUIRED: "開始後の変更理由を入力してください。", FORBIDDEN: "このシフトの配置を編集する権限がありません。", NOT_FOUND: "対象シフトが見つかりません。", INVALID_STATE: "キャンセル済みシフトは編集できません。", INVALID_SCOPE: "配置対象がこのシフトの編集範囲外です。", INVALID_INPUT: "入力内容を確認してください。" };
export async function savePlacementPlan(input: PlacementSaveInput): Promise<PlacementSaveResult> {
  const parsed = schema.safeParse(input); if (!parsed.success) return { ok: false, type: "validation", message: "入力内容を確認してください。" };
  const auth = await getCurrentProfile(); if (auth.status !== "authenticated" || auth.profile.account_type === "worker") return { ok: false, type: "forbidden", code: "FORBIDDEN", message: messages.FORBIDDEN };
  try {
    const supabase = await createClient(); const d = parsed.data;
    const result = await supabase.rpc("save_shift_placement_plan", { p_shift_slot_id: d.shiftId, p_expected_version: d.version, p_idempotency_key: d.idempotencyKey, p_reason: d.reason || null,
      p_positions: d.positions.map((p) => ({ id: p.id, label: p.label, required_workers: p.requiredWorkers, display_order: p.displayOrder, retired: p.retired })),
      p_placement_segments: d.segments.map((s) => ({ id: s.id, assignment_id: s.assignmentId, position_id: s.positionId, start_at: s.startAt, end_at: s.endAt })),
      p_break_intervals: d.breaks.map((b) => ({ id: b.id, assignment_id: b.assignmentId, start_at: b.startAt, end_at: b.endAt })), });
    if (result.error) { const code = Object.keys(messages).find((key) => result.error!.message.includes(key)) ?? "INVALID_INPUT"; const type = code === "FORBIDDEN" ? "forbidden" : code === "NOT_FOUND" ? "notFound" : "validation"; return { ok: false, type, code, message: messages[code] }; }
    const data = result.data as { ok: boolean; code?: string; version?: number; current_version?: number; warnings?: unknown[]; replayed?: boolean };
    if (!data.ok) { const code = data.code ?? "INVALID_INPUT"; return { ok: false, type: code === "VERSION_CONFLICT" ? "conflict" : "validation", code, message: messages[code] ?? messages.INVALID_INPUT, currentVersion: data.current_version }; }
    revalidatePath("/admin/placement"); return { ok: true, version: data.version!, warnings: data.warnings ?? [], replayed: Boolean(data.replayed) };
  } catch { console.error("Failed to save placement plan"); return { ok: false, type: "error", message: "配置を保存できませんでした。時間をおいて再度お試しください。" }; }
}
