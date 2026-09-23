"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, X } from "lucide-react";
import { Drawer } from "@/components/admin/drawer";
import { AdminFeedback, adminStateActionClass } from "@/components/admin/admin-state";
import { ensureCandidateAssignment, type CandidateAssignmentActionResult } from "@/app/actions/candidate-assignments";
import { candidateGroup, type CandidateAssignmentDecision, type CandidateGroup, type ShiftCandidate } from "@/lib/admin/staff/candidate-picker-types";

const groupLabel: Record<CandidateGroup, string> = {
  eligible: "候補",
  warning: "確認が必要",
  ineligible: "候補外",
};

const groupTone: Record<CandidateGroup, string> = {
  eligible: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  ineligible: "bg-danger-subtle text-danger",
};

const availabilityLabel: Record<string, string> = {
  available: "勤務可能",
  consultable: "相談可能",
  partial: "一部確認済み",
  unavailable: "勤務不可",
  unknown: "勤務可否未登録",
};

const preferenceLabel: Record<string, string> = {
  matched: "希望時間一致",
  partially_matched: "希望時間一部一致",
  not_matched: "希望時間不一致",
  not_configured: "希望時間未設定",
};

export function CandidatePickerDrawer({ shiftId, candidates, closeHref, shiftLabel, truncated, loadError = false }: { shiftId: string; candidates: ShiftCandidate[]; closeHref: string; shiftLabel: string; truncated: boolean; loadError?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CandidateGroup>("all");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [result, setResult] = useState<CandidateAssignmentActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);
  const close = () => {
    window.sessionStorage.setItem("admin-placement-return-focus", "candidate-picker-trigger");
    router.push(closeHref, { scroll: false });
  };
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja-JP");
    return candidates
      .filter((candidate) => filter === "all" || candidateGroup(candidate) === filter)
      .filter((candidate) => !normalized || candidate.displayName.toLocaleLowerCase("ja-JP").includes(normalized) || candidate.staffCode.toLocaleLowerCase("ja-JP").includes(normalized))
      .sort((a, b) => {
        const groupOrder = { eligible: 0, warning: 1, ineligible: 2 };
        const groupDifference = groupOrder[candidateGroup(a)] - groupOrder[candidateGroup(b)];
        return groupDifference || a.displayName.localeCompare(b.displayName, "ja") || a.staffCode.localeCompare(b.staffCode) || a.workerId.localeCompare(b.workerId);
      });
  }, [candidates, filter, query]);
  const selected = candidates.find((candidate) => candidate.workerId === selectedWorkerId) ?? null;
  const selectCandidate = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setResult(null);
    operation.current = null;
  };
  const proceed = () => {
    if (!selected || pending) return;
    const assignmentPath = selected.assignmentDecision === "accepted_application_available"
      ? "accepted_application"
      : "direct_admin";
    const fingerprint = `${shiftId}:${selected.workerId}:${assignmentPath}`;
    if (operation.current?.fingerprint !== fingerprint) {
      operation.current = { fingerprint, key: crypto.randomUUID() };
    }
    setResult(null);
    startTransition(async () => {
      try {
        const response = await ensureCandidateAssignment({
          shiftId,
          workerId: selected.workerId,
          assignmentPath,
          idempotencyKey: operation.current!.key,
        });
        setResult(response);
        if (response.ok) {
          operation.current = null;
          router.push(`${closeHref}&assignmentId=${response.assignmentId}`, { scroll: false });
        } else if (!response.retryable) {
          operation.current = null;
        }
      } catch {
        setResult({ ok: false, outcome: "UNKNOWN", message: "通信結果を確認できませんでした。同じ操作を再度お試しください。", retryable: true });
      }
    });
  };

  return <Drawer open titleId="candidate-picker-title" onClose={close} width="narrow">
    <header className="sticky top-0 z-20 flex items-start justify-between border-b border-border bg-surface p-4 sm:p-6">
      <div className="min-w-0"><p className="text-sm font-medium text-link">配置</p><h2 id="candidate-picker-title" className="mt-1 text-xl font-semibold">スタッフを選択</h2><p className="mt-1 truncate text-xs text-foreground-muted">{shiftLabel}</p></div>
      <button autoFocus type="button" onClick={close} aria-label="候補選択を閉じる" className="inline-flex size-11 shrink-0 items-center justify-center rounded-control hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><X aria-hidden className="size-5" /></button>
    </header>

    <div className="flex-1 space-y-5 p-4 sm:p-6">
      <label className="block text-sm font-medium">スタッフ名・スタッフコードで検索<span className="relative mt-2 block"><Search aria-hidden className="pointer-events-none absolute left-3 top-3 size-5 text-foreground-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-control border border-border-strong bg-surface py-2 pl-10 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring" placeholder="例：田中 / STAFF-001" /></span></label>

      <div role="group" aria-label="候補状態で絞り込み" className="flex flex-wrap gap-2">
        {(["all", "eligible", "warning", "ineligible"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-control border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${filter === value ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-foreground-secondary hover:bg-surface-hover"}`}>{value === "all" ? "すべて" : groupLabel[value]}</button>)}
      </div>

      <section aria-labelledby="candidate-list-heading">
        <div className="flex items-end justify-between gap-3"><div><h3 id="candidate-list-heading" className="font-semibold">候補者</h3><p className="mt-1 text-xs text-foreground-muted">canonical factsの判定理由を表示します</p></div><p className="text-xs tabular-nums text-foreground-muted">{visible.length}名</p></div>
        {loadError && <p role="alert" className="mt-4 rounded-control border border-danger/30 bg-danger-subtle p-4 text-sm text-danger">候補を取得できませんでした。閉じてから再度お試しください。</p>}
        {truncated && <p className="mt-3 rounded-control bg-warning-subtle px-3 py-2 text-xs text-warning">候補は先頭100名まで表示しています。</p>}
        {!loadError && (visible.length === 0 ? <p className="mt-4 rounded-control bg-surface-subtle p-4 text-sm text-foreground-muted">条件に一致する候補はいません。</p> : <ul className="mt-4 space-y-3">{visible.map((candidate) => <CandidateCard key={candidate.workerId} candidate={candidate} selected={selectedWorkerId === candidate.workerId} pending={pending} onSelect={() => selectCandidate(candidate.workerId)} />)}</ul>)}
      </section>
    </div>

    <footer className="sticky bottom-0 border-t border-border bg-surface p-4 sm:px-6">
      {selected ? <div role="status" className="mb-3 flex items-center gap-2 rounded-control bg-primary-subtle px-3 py-2 text-sm text-primary"><Check aria-hidden className="size-4" /><span className="min-w-0 truncate">選択中：{selected.displayName}（{selected.staffCode}）</span></div> : null}
      {result && !result.ok && <AdminFeedback kind="error" message={result.message}>{result.blockingReasons?.length ? <ul className="mt-2 space-y-1 text-xs">{result.blockingReasons.map((reason) => <li key={reason.code}>・{reason.label}</li>)}</ul> : null}</AdminFeedback>}
      {pending && <AdminFeedback kind="pending" message="現在の状態を再確認してAssignmentを確定しています。" />}
      <p className="mt-3 text-xs text-foreground-muted">スタッフ選択だけではAssignmentや配置は変更されません。次の操作でAssignmentを確定し、配置エディタを開きます。</p>
      {selected && <DecisionAction candidate={selected} pending={pending} onProceed={proceed} />}
      <button type="button" onClick={close} disabled={pending} className={`${adminStateActionClass} mt-3 w-full`}>閉じる</button>
    </footer>
  </Drawer>;
}

function DecisionAction({ candidate, pending, onProceed }: { candidate: ShiftCandidate; pending: boolean; onProceed: () => void }) {
  const decision = candidate.assignmentDecision;
  const blocked: Partial<Record<CandidateAssignmentDecision, string>> = {
    application_decision_required: "応募の承認または却下を先に完了してください。",
    application_rejected: "却下済み応募のため、ここからAssignmentは作成できません。",
    application_withdrawn: "辞退済み応募のため、ここからAssignmentは作成できません。",
  };
  const blockedMessage = blocked[decision];
  if (blockedMessage) return <p className="mt-3 rounded-control bg-warning-subtle p-3 text-sm text-warning-foreground">{blockedMessage}</p>;
  const label = decision === "existing_assignment"
    ? "配置へ進む"
    : decision === "accepted_application_available"
      ? "承認済み応募からアサインして配置へ進む"
      : "このシフトにアサインして配置へ進む";
  const canProceed = decision === "existing_assignment" || candidate.facts.candidateEligible;
  return <button type="button" disabled={pending || !canProceed} onClick={onProceed} className="mt-3 min-h-11 w-full rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:bg-surface-muted disabled:text-foreground-disabled">{pending ? "確認中…" : label}</button>;
}

function CandidateCard({ candidate, selected, pending, onSelect }: { candidate: ShiftCandidate; selected: boolean; pending: boolean; onSelect: () => void }) {
  const group = candidateGroup(candidate);
  const facts = candidate.facts;
  const requirements = facts.requirements;
  const satisfied = requirements.filter((item) => item.state === "satisfied").length;
  const requirementSummary = requirements.length === 0 ? "必要Skill・資格なし" : `必要条件 ${satisfied}/${requirements.length}件を充足`;
  const schedulePreference = preferenceLabel[facts.preferenceMatches.preferredSchedule] ?? "希望条件は参考情報";
  const selectable = facts.candidateEligible || facts.targetShiftAssignment.state === "active_existing";
  return <li className={`rounded-panel border p-4 ${selected ? "border-primary ring-2 ring-primary/20" : group === "ineligible" ? "border-danger/30 bg-danger-subtle/30" : "border-border bg-surface"}`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{candidate.displayName}</p><p className="mt-1 text-xs text-foreground-muted">{candidate.staffCode}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${groupTone[group]}`}>{groupLabel[group]}</span></div>
    {facts.targetShiftAssignment.state === "active_existing" && <p className="mt-3 rounded-control bg-info-subtle px-3 py-2 text-xs font-medium text-info">このシフトにAssignment済み（{facts.targetShiftAssignment.status}）</p>}
    <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-surface-subtle px-2.5 py-1">{availabilityLabel[facts.availabilityState] ?? facts.availabilityState}</span><span className="rounded-full bg-surface-subtle px-2.5 py-1">{requirementSummary}</span><span className="rounded-full bg-surface-subtle px-2.5 py-1">{facts.overlapEligible ? "別シフト重複なし" : "別シフト重複あり"}</span></div>
    {requirements.length > 0 && <ul aria-label="Skill・資格要件" className="mt-3 space-y-1 text-xs text-foreground-secondary">{requirements.map((item) => <li key={`${item.kind}-${item.masterId}`}>{item.kind === "skill" ? "Skill" : "資格"}：{item.name} — {item.state === "satisfied" ? "充足" : item.state}</li>)}</ul>}
    {facts.blockingReasons.length > 0 && <ReasonList title="候補外の理由" reasons={facts.blockingReasons} tone="text-danger" />}
    {facts.warnings.length > 0 && <ReasonList title="確認事項" reasons={facts.warnings} tone="text-warning" />}
    <p className="mt-3 text-xs text-foreground-muted">希望条件：{schedulePreference}</p>
    {facts.conflictingAssignments.length > 0 && <p className="mt-2 text-xs font-medium text-danger">別シフトとの時間重複 {facts.conflictingAssignments.length}件</p>}
    <button type="button" disabled={!selectable || pending} onClick={onSelect} className={`mt-4 min-h-11 w-full rounded-control px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${selectable && !pending ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "cursor-not-allowed bg-surface-muted text-foreground-disabled"}`}>{!selectable ? "選択できません" : selected ? "選択済み" : facts.targetShiftAssignment.state === "active_existing" ? "Assignmentを選択" : group === "warning" ? "確認して選択" : "選択"}</button>
  </li>;
}

function ReasonList({ title, reasons, tone }: { title: string; reasons: { code: string; label: string }[]; tone: string }) {
  return <div className="mt-3"><p className={`text-xs font-semibold ${tone}`}>{title}</p><ul className={`mt-1 space-y-1 text-xs ${tone}`}>{reasons.map((reason) => <li key={reason.code}>・{reason.label}</li>)}</ul></div>;
}
