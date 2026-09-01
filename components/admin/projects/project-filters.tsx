import Link from "next/link";
import { Search } from "lucide-react";
import {
  PROJECT_PERIOD_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/admin/projects/project-rules";
import { PROJECT_STATUSES, type ProjectQuery } from "@/lib/admin/projects/project-types";

export function ProjectFilters({ filters }: { filters: ProjectQuery }) {
  const hasFilters = Boolean(filters.q || filters.status !== "all" || filters.period !== "all");

  return (
    <form method="GET" action="/admin/projects" aria-label="案件の検索と絞り込み" className="rounded-ds-card border border-border bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(15rem,1fr)_10rem_10rem_auto] md:items-center">
        <label className="block">
          <span className="sr-only">案件名・取引先</span>
          <span className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder="案件名・取引先を検索"
              className="min-h-11 w-full rounded-ds-control border border-border-strong bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-foreground-disabled focus:border-focus-ring focus:bg-surface focus:ring-2 focus:ring-info-subtle"
            />
          </span>
        </label>
        <label className="block">
          <span className="sr-only">状態</span>
          <select aria-label="状態" name="status" defaultValue={filters.status} className="min-h-11 w-full rounded-ds-control border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus-ring focus:ring-2 focus:ring-info-subtle">
            <option value="all">すべて</option>
            {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">期間</span>
          <select aria-label="期間" name="period" defaultValue={filters.period} className="min-h-11 w-full rounded-ds-control border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus-ring focus:ring-2 focus:ring-info-subtle">
            {Object.entries(PROJECT_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-ds-control bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
          検索
        </button>
      </div>
      {hasFilters && <div className="mt-2 flex justify-end"><Link href="/admin/projects" className="inline-flex min-h-11 items-center text-sm font-medium text-link underline-offset-4 hover:text-link-hover hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">フィルターをクリア</Link></div>}
    </form>
  );
}
