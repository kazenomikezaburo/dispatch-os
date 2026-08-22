"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelAssignmentByCompany } from "@/app/actions/assignments";

export function AssignmentCancelButton({
  shiftId,
  assignmentId,
  workerName,
  startsAt,
}: {
  shiftId: string;
  assignmentId: string;
  workerName: string;
  startsAt: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [canCancel, setCanCancel] = useState(false);

  useEffect(() => {
    const startsAtTime = new Date(startsAt).getTime();
    const showTimer = window.setTimeout(() => {
      setCanCancel(Date.now() < startsAtTime);
    }, 0);
    const remaining = startsAtTime - Date.now();
    const hideTimer = remaining > 0 && remaining <= 2_147_483_647
      ? window.setTimeout(() => setCanCancel(false), remaining)
      : null;
    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
    };
  }, [startsAt]);

  function cancel() {
    if (!window.confirm(`${workerName}さんの配置を解除しますか？\n\n配置人数が減り、人員不足になる場合があります。`)) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelAssignmentByCompany(shiftId, assignmentId);
      if (!result.ok) setError(result.message);
    });
  }

  if (!canCancel) return null;

  return (
    <div className="mt-3 sm:mt-0 sm:text-right">
      <button
        type="button"
        disabled={isPending}
        onClick={cancel}
        className="min-h-10 rounded-md border border-red-300 bg-white px-4 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
      >
        {isPending ? "解除中..." : "配置を解除"}
      </button>
      {error && <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">{error}</p>}
    </div>
  );
}
