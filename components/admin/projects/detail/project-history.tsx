import Link from "next/link";
import { encodeProjectHistoryCursor } from "@/lib/admin/projects/project-history-cursor";
import type { ProjectHistoryEvent, ProjectHistoryPage } from "@/lib/admin/projects/project-history-types";

const dateTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

const fieldLabels: Record<string, string> = {
  name: "案件名", status: "状態", client_id: "取引先", start_date: "開始日", end_date: "終了日",
  description: "説明", workplace_id: "勤務先・会場", postal_code: "郵便番号", address: "住所", default_transport_note: "交通案内", access_note: "アクセス補足", meeting_note: "集合案内", is_active: "状態", starts_at: "開始日時", ends_at: "終了日時", required_workers: "必要人数",
};

function changedFields(payload: Record<string, unknown>): string | null {
  if (!Array.isArray(payload.changed_fields)) return null;
  const labels = payload.changed_fields
    .filter((value): value is string => typeof value === "string" && value in fieldLabels)
    .map((value) => fieldLabels[value]);
  return labels.length ? labels.join("・") : null;
}

export function projectHistorySummary(event: ProjectHistoryEvent): { summary: string; context: string | null } {
  const label = event.targetLabel;
  const context = changedFields(event.payload);
  switch (event.eventType) {
    case "PROJECT_CREATED": return { summary: "案件を作成しました", context };
    case "PROJECT_UPDATED": return { summary: "案件情報を更新しました", context };
    case "PROJECT_STATUS_CHANGED": return { summary: "案件の状態を変更しました", context };
    case "JOB_CREATED": return { summary: `業務「${label}」を追加しました`, context };
    case "JOB_UPDATED": return { summary: `業務「${label}」を更新しました`, context };
    case "JOB_STATUS_CHANGED": return { summary: `業務「${label}」の状態を変更しました`, context };
    case "JOB_WORKPLACE_CHANGED": return { summary: `業務「${label}」の勤務先を変更しました`, context };
    case "SHIFT_CREATED": return { summary: "シフトを追加しました", context: label || context };
    case "SHIFT_UPDATED": return { summary: "シフトを更新しました", context: label || context };
    case "SHIFT_STATUS_CHANGED": return { summary: "シフトの状態を変更しました", context: label || context };
    case "PROJECT_CONTEXT_WORKPLACE_UPDATED": return { summary: `勤務先・会場「${label}」を更新しました`, context };
  }
}

export function ProjectHistory({ projectId, page }: { projectId: string; page: ProjectHistoryPage }) {
  return <section aria-labelledby="history-title">
    <div><h2 id="history-title" className="text-lg font-semibold text-foreground">変更履歴</h2><p className="mt-1 text-sm text-foreground-muted">履歴機能の導入後に行われた、案件構造と設定の変更を表示します。</p></div>
    {page.items.length === 0 ? <div className="mt-5 rounded-panel border border-dashed border-border-strong bg-surface-subtle px-5 py-10 text-center"><p className="font-semibold text-foreground">記録された履歴はまだありません</p><p className="mt-1 text-sm text-foreground-muted">履歴機能の導入後に行われた変更が表示されます。</p></div> : <ol aria-label="案件の変更履歴" className="mt-5 space-y-0 border-l border-border pl-5">{page.items.map((event) => {
      const presentation = projectHistorySummary(event);
      return <li key={event.id} className="relative border-b border-border py-5 first:pt-0 last:border-b-0"><span aria-hidden className="absolute -left-[1.58rem] top-6 size-2.5 rounded-full border-2 border-surface bg-primary first:top-1" /><time dateTime={event.createdAt} className="text-xs tabular-nums text-foreground-muted">{dateTime.format(new Date(event.createdAt))}</time><p className="mt-1 text-sm font-medium text-foreground-secondary">{event.actorDisplayName}</p><p className="mt-2 font-semibold text-foreground">{presentation.summary}</p>{presentation.context && <p className="mt-1 text-sm text-foreground-muted">{presentation.context}</p>}</li>;
    })}</ol>}
    {page.nextCursor && <div className="mt-6 flex justify-center"><Link href={`/admin/projects/${encodeURIComponent(projectId)}?tab=history&cursor=${encodeURIComponent(encodeProjectHistoryCursor(page.nextCursor))}`} className="inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">さらに読み込む</Link></div>}
  </section>;
}
