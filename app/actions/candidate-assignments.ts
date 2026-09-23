"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getPlacementPlan } from "@/lib/admin/placement/get-placement-plan";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const schema = z.object({
  shiftId: uuidSchema,
  workerId: uuidSchema,
  assignmentPath: z.enum(["accepted_application", "direct_admin"]),
  idempotencyKey: z.string().uuid(),
});

type BlockingReason = { code: string; label: string };

export type CandidateAssignmentActionResult =
  | { ok: true; outcome: "assignment_created" | "existing_assignment"; assignmentId: string; replayed: boolean }
  | { ok: false; outcome: string; message: string; retryable: boolean; blockingReasons?: BlockingReason[] };

const messages: Record<string, string> = {
  capacity_reached: "必要人数に達したため、新しいAssignmentを作成できませんでした。",
  not_eligible: "現在の勤務条件では、このスタッフをアサインできません。",
  accepted_application_available: "承認済みの応募があります。応募経由でアサインしてください。",
  application_decision_required: "応募の承認または却下を先に完了してください。",
  application_rejected: "却下済みの応募を自動的に上書きすることはできません。",
  application_withdrawn: "辞退済みの応募を自動的に上書きすることはできません。",
  shift_state_unavailable: "現在のシフト状態ではAssignmentを作成できません。",
  unavailable: "対象を確認できないか、この操作を実行する権限がありません。",
  IDEMPOTENCY_CONFLICT: "同じ操作キーの内容が一致しません。もう一度操作してください。",
};

export async function ensureCandidateAssignment(
  input: z.infer<typeof schema>,
): Promise<CandidateAssignmentActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return failure("INVALID_INPUT", "入力内容を確認してください。");
  const auth = await getCurrentProfile();
  if (auth.status !== "authenticated" || auth.profile.account_type === "worker") {
    return failure("unavailable", messages.unavailable);
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("ensure_candidate_assignment", {
      p_shift_id: parsed.data.shiftId,
      p_worker_id: parsed.data.workerId,
      p_assignment_path: parsed.data.assignmentPath,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (error) throw error;
    const result = data as {
      ok?: boolean;
      outcome?: string;
      assignmentId?: string | null;
      replayed?: boolean;
      blockingReasons?: BlockingReason[];
    } | null;
    const outcome = result?.outcome ?? "unavailable";
    if (!result?.ok || !result.assignmentId || !["assignment_created", "existing_assignment"].includes(outcome)) {
      return {
        ok: false,
        outcome,
        message: messages[outcome] ?? "Assignmentを確定できませんでした。最新の状態を確認してください。",
        retryable: false,
        blockingReasons: Array.isArray(result?.blockingReasons) ? result.blockingReasons : undefined,
      };
    }

    const plan = await getPlacementPlan(parsed.data.shiftId);
    if (!plan?.assignments.some((item) => item.assignmentId === result.assignmentId)) {
      return failure("PLACEMENT_REFRESH_REQUIRED", "Assignmentは確定しました。配置画面を再読み込みしてください。", true);
    }
    revalidatePath(`/admin/shifts/${parsed.data.shiftId}`);
    revalidatePath("/admin/placement");
    return {
      ok: true,
      outcome: outcome as "assignment_created" | "existing_assignment",
      assignmentId: result.assignmentId,
      replayed: result.replayed === true,
    };
  } catch (error) {
    console.error("Failed to ensure Candidate Assignment", error);
    return failure("UNKNOWN", "通信結果を確認できませんでした。同じ操作を再度お試しください。", true);
  }
}

function failure(outcome: string, message: string, retryable = false): CandidateAssignmentActionResult {
  return { ok: false, outcome, message, retryable };
}
