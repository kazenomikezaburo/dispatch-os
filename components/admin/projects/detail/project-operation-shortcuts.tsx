import Link from "next/link";
import { ArrowRight } from "lucide-react";

type ProjectOperationHrefs = {
  shifts: string;
  placement: string;
  preShift: string;
  dayOf: string;
};

const items = [
  { key: "shifts", label: "シフト一覧", description: "案件内のシフトを選ぶ" },
  { key: "placement", label: "配置・休憩", description: "案件で絞り込んで確認する" },
  { key: "preShift", label: "前日確認", description: "案件で絞り込んで確認する" },
  { key: "dayOf", label: "当日運用", description: "案件で絞り込んで確認する" },
] as const;

export function ProjectOperationShortcuts({ hrefs }: { hrefs: ProjectOperationHrefs }) {
  return <section aria-labelledby="project-operation-shortcuts-title">
    <h2 id="project-operation-shortcuts-title" className="text-lg font-semibold text-foreground">関連する運用画面</h2>
    <p className="mt-1 text-sm text-foreground-muted">案件で対象を絞り込み、シフトを選択して個別の運用へ進みます。</p>
    <nav aria-label="案件に関連する運用画面" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => <Link key={item.key} href={hrefs[item.key]} className="group flex min-h-20 items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
        <span><span className="block text-sm font-semibold text-foreground">{item.label}</span><span className="mt-1 block text-xs text-foreground-muted">{item.description}</span></span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-foreground-muted group-hover:text-link" />
      </Link>)}
    </nav>
  </section>;
}
