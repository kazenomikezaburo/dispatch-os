"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { recordOwnAssignmentJourneyEvent, type WorkerJourneyActionResult } from "@/app/actions/worker-journey";
import type { JourneyType } from "@/lib/worker/journey/worker-journey";

const labels: Record<JourneyType, string> = {
  wake: "起きました",
  departure: "出発しました",
  arrival: "到着しました",
};

const pendingLabels: Record<JourneyType, string> = {
  wake: "起床を記録中…",
  departure: "出発を記録中…",
  arrival: "到着を記録中…",
};

const initialState: WorkerJourneyActionResult = { ok: false, code: "UNAVAILABLE", message: "", retryable: false };

export function WorkerJourneyActionButton({ assignmentId, journeyType, compact = false }: { assignmentId: string; journeyType: JourneyType; compact?: boolean }) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [result, action, pending] = useActionState(async () => {
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const next = await recordOwnAssignmentJourneyEvent({ assignmentId, journeyType, idempotencyKey: idempotencyKey.current });
      if (!next.retryable) idempotencyKey.current = null;
      if (next.ok) router.refresh();
      return next;
    } catch {
      return { ok: false, code: "UNKNOWN", message: "通信結果を確認できませんでした。同じ操作をもう一度お試しください。", retryable: true } satisfies WorkerJourneyActionResult;
    }
  }, initialState);

  return <form action={action} className={compact ? "mt-3" : "mt-4"}>
    <button type="submit" disabled={pending} className={`${compact ? "w-full sm:w-auto" : "w-full"} inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400`}>
      {pending ? pendingLabels[journeyType] : labels[journeyType]}
    </button>
    {result.message && <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`} role={result.ok ? "status" : "alert"}>{result.message}</p>}
  </form>;
}
