"use client";

import { useState, useTransition } from "react";
import { recordWorkerEndWork, recordWorkerStartWork } from "@/app/actions/attendance";

export function AttendanceActionButton({ assignmentId, kind }: { assignmentId: string; kind: "start" | "end" }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = kind === "start" ? "勤務を開始する" : "勤務を終了する";
  const confirmation = kind === "start" ? "勤務を開始しますか？" : "勤務を終了しますか？";
  const action = kind === "start" ? recordWorkerStartWork : recordWorkerEndWork;

  return <div>
    <button type="button" disabled={isPending} onClick={() => {
      if (!window.confirm(confirmation)) return;
      setError(null);
      startTransition(async () => {
        const result = await action({ assignmentId });
        if (!result.ok) setError(result.message);
      });
    }} className="min-h-12 w-full rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-slate-400">
      {isPending ? "打刻中..." : label}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>;
}
