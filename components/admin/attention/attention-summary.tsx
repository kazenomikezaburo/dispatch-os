import type { AttentionSummary as Summary } from "@/lib/admin/attention/attention-types";

const metrics = [
  { key:"urgent",label:"緊急",hint:"SOS",tone:"text-danger" },
  { key:"staffing",label:"配置",hint:"人員・Coverage",tone:"text-warning-foreground" },
  { key:"confirmation",label:"確認",hint:"前日・勤怠",tone:"text-link" },
  { key:"dayOf",label:"当日",hint:"開始報告・遅刻",tone:"text-foreground" },
] as const;

export function AttentionSummary({summary}:{summary:Summary}){
  return <section aria-label="要対応サマリー" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {metrics.map(metric=><article key={metric.key} className="rounded-panel border border-border bg-surface p-4"><p className="text-xs font-semibold text-foreground-muted">{metric.label}</p><p className={`mt-1 text-3xl font-semibold tabular-nums ${metric.tone}`}>{summary[metric.key]}<span className="ml-1 text-base">件</span></p><p className="mt-1 text-xs text-foreground-muted">{metric.hint}</p></article>)}
  </section>;
}

