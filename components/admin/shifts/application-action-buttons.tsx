"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptShiftApplication,
  rejectShiftApplication,
} from "@/app/actions/shift-applications";

export function ApplicationActionButtons({
  shiftId,
  applicationId,
  workerName,
}: {
  shiftId: string;
  applicationId: string;
  workerName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = (decision: "accept" | "reject") => {
    if (decision === "reject" && !window.confirm(`${workerName}さんを不採用にしますか？`)) return;
    setError("");
    startTransition(async () => {
      const result = decision === "accept"
        ? await acceptShiftApplication(shiftId, applicationId)
        : await rejectShiftApplication(shiftId, applicationId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return <div className="mt-3 sm:mt-0"><div className="flex flex-wrap gap-2"><button type="button" disabled={isPending} onClick={() => run("accept")} className="min-h-10 rounded-md bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400">{isPending ? "処理中..." : "承認"}</button><button type="button" disabled={isPending} onClick={() => run("reject")} className="min-h-10 rounded-md border border-red-300 px-4 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">{isPending ? "処理中..." : "不採用"}</button></div>{error && <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">{error}</p>}</div>;
}
