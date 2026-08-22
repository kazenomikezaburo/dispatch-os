"use client";

import { useState, useTransition } from "react";
import { markAssignmentAbsent, markAssignmentNoShow } from "@/app/actions/assignments";

export function AssignmentAbsenceActions({ shiftId, assignmentId, workerName, canMarkAbsent, canMarkNoShow }: {
  shiftId: string;
  assignmentId: string;
  workerName: string;
  canMarkAbsent: boolean;
  canMarkNoShow: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<"absent" | "no_show" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(kind: "absent" | "no_show") {
    const prompt = kind === "absent"
      ? `${workerName}さんを欠勤にしますか？\n\nこの操作を行うと、この勤務では勤務開始できなくなります。`
      : `${workerName}さんを無断欠勤にしますか？\n\n勤務開始時刻を過ぎています。勤務開始打刻がないことと、本人からの連絡状況を確認してください。`;
    if (!window.confirm(prompt)) return;
    setError(null);
    setPendingKind(kind);
    startTransition(async () => {
      const result = kind === "absent"
        ? await markAssignmentAbsent(shiftId, assignmentId)
        : await markAssignmentNoShow(shiftId, assignmentId);
      if (!result.ok) setError(result.message);
      setPendingKind(null);
    });
  }

  if (!canMarkAbsent) return null;
  return <div className="flex flex-wrap items-start gap-2">
    <button type="button" disabled={isPending} onClick={() => submit("absent")} className="min-h-11 rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
      {isPending && pendingKind === "absent" ? "欠勤処理中..." : "欠勤にする"}
    </button>
    {canMarkNoShow && <button type="button" disabled={isPending} onClick={() => submit("no_show")} className="min-h-11 rounded-md border border-red-300 bg-white px-3 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
      {isPending && pendingKind === "no_show" ? "無断欠勤処理中..." : "無断欠勤にする"}
    </button>}
    {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
  </div>;
}
