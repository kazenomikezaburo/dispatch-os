"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignWorkerToShift } from "@/app/actions/assignments";

export function AssignmentActionButton({
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

  const assign = () => {
    if (!window.confirm(`${workerName}さんをこのシフトに配置しますか？`)) return;
    setError("");
    startTransition(async () => {
      const result = await assignWorkerToShift(shiftId, applicationId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return <div className="mt-3 sm:mt-0"><button type="button" disabled={isPending} onClick={assign} className="min-h-10 rounded-md bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400">{isPending ? "配置中..." : "配置する"}</button>{error && <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">{error}</p>}</div>;
}
