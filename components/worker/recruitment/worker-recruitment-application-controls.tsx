"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  applyToOwnShift,
  withdrawOwnShiftApplication,
  type WorkerApplicationActionResult,
} from "@/app/actions/worker-shift-applications";
import type { RecruitmentShift } from "@/lib/worker/recruitment/get-worker-recruitment";

const initialState: WorkerApplicationActionResult = {
  ok: false,
  outcome: "idle",
  message: "",
  retryable: false,
  applicationState: null,
  replayed: false,
};

export function WorkerRecruitmentApplicationControls({
  shiftId,
  state,
}: {
  shiftId: string;
  state: RecruitmentShift["state"];
}) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const operation = state === "applied" ? "withdraw" : "apply";
  const command = operation === "withdraw" ? withdrawOwnShiftApplication : applyToOwnShift;
  const [result, action, pending] = useActionState(async () => {
    idempotencyKey.current ??= crypto.randomUUID();
    const response = await command({ shiftId, idempotencyKey: idempotencyKey.current });
    if (!response.retryable) idempotencyKey.current = null;
    router.refresh();
    return response;
  }, initialState);

  if (!["available", "available_with_warning", "applied"].includes(state)) {
    return result.message ? (
      <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`} role={result.ok ? "status" : "alert"}>
        {result.message}
      </p>
    ) : null;
  }

  const withdrawing = operation === "withdraw";
  return (
    <form action={action} className="mt-5">
      <button
        disabled={pending}
        className={withdrawing
          ? "min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          : "min-h-11 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"}
      >
        {pending ? (withdrawing ? "取下げ中..." : "応募中...") : (withdrawing ? "応募を取り下げる" : "応募する")}
      </button>
      {result.message && (
        <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`} role={result.ok ? "status" : "alert"}>
          {result.message}
        </p>
      )}
    </form>
  );
}
