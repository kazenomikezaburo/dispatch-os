import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "info" | "warning" | "danger" | "success";
const tones: Record<Tone, string> = {
  neutral: "border-l-foreground-muted", info: "border-l-info", warning: "border-l-warning", danger: "border-l-danger", success: "border-l-success",
};

// Presentation only: callers own authorization, retries and domain state.
export function AdminState({ title, description, tone = "neutral", children, live = false }: { title: string; description?: string; tone?: Tone; children?: ReactNode; live?: boolean }) {
  return <section role={live ? (tone === "danger" || tone === "warning" ? "alert" : "status") : undefined} className={cn("rounded-panel border border-border border-l-4 bg-surface p-5 sm:p-6", tones[tone])}>
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    {description && <p className="mt-2 text-sm text-foreground-secondary">{description}</p>}
    {children && <div className="mt-4 flex flex-wrap gap-3">{children}</div>}
  </section>;
}
export const adminStateActionClass = "inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:text-foreground-disabled";
export function AdminEmptyState({ title = "データがありません", description = "条件を変更するか、新しいデータを追加してください。", children }: { title?: string; description?: string; children?: ReactNode }) { return <AdminState title={title} description={description}>{children}</AdminState>; }
export function AdminErrorState({ title = "読み込みに失敗しました", children }: { title?: string; children?: ReactNode }) { return <AdminState title={title} description="時間をおいて再度お試しください。" tone="danger" live>{children}</AdminState>; }
export function AdminLoadingState() { return <AdminState title="読み込み中…" description="最新の情報を取得しています。" tone="info" live />; }
export function AdminForbiddenState({ message = "必要な権限を持つ管理者へ確認してください。" }: { message?: string }) { return <AdminState title="この操作を行う権限がありません" description={message} live />; }
export function AdminNotFoundState({ children }: { children?: ReactNode }) { return <AdminState title="対象が見つかりません" description="対象を表示できません。一覧から選び直してください。">{children}</AdminState>; }
export function AdminFeedback({ kind, message, children }: { kind: "conflict" | "pending" | "success" | "error" | "unsaved"; message: string; children?: ReactNode }) {
  const tone: Tone = { conflict: "warning", pending: "info", success: "success", error: "danger", unsaved: "neutral" }[kind] as Tone;
  return <div role={kind === "error" || kind === "conflict" ? "alert" : "status"} className={cn("rounded-control border border-border border-l-4 bg-surface px-4 py-3 text-sm text-foreground-secondary", tones[tone])}><p>{message}</p>{children && <div className="mt-3">{children}</div>}</div>;
}
