import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function AdminEditorSection({ id, title, description, children, className }: { id: string; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return <section aria-labelledby={id} className={cn("rounded-panel border border-border bg-surface p-4 sm:p-6", className)}>
    <h2 id={id} className="text-lg font-semibold text-foreground">{title}</h2>
    {description && <p className="mt-1 text-sm text-foreground-secondary">{description}</p>}
    <div className="mt-5">{children}</div>
  </section>;
}

export function AdminEditorFooter({ cancelHref, disabled, submitLabel, pendingLabel, pending, note }: { cancelHref: string; disabled?: boolean; submitLabel: string; pendingLabel: string; pending: boolean; note?: string }) {
  return <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <p className="text-xs text-foreground-muted">{note}</p>
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {pending ? <button type="button" disabled className="min-h-11 rounded-control border border-border-strong px-5 text-sm font-medium text-foreground-disabled">キャンセル</button> : <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-sm font-medium text-secondary-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">キャンセル</Link>}
      <button type="submit" disabled={disabled || pending} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-disabled">{pending ? pendingLabel : submitLabel}</button>
    </div>
  </div>;
}
