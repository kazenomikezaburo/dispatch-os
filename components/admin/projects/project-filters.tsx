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
    <form method="GET" action="/admin/projects" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(15rem,1fr)_12rem_12rem_auto] md:items-end">
        <label className="block text-sm font-medium text-slate-800">
          案件名・取引先
          <span className="relative mt-1.5 block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder="案件名・取引先を検索"
              className="min-h-10 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          状態
          <select name="status" defaultValue={filters.status} className="mt-1.5 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
            <option value="all">すべて</option>
            {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          期間
          <select name="period" defaultValue={filters.period} className="mt-1.5 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
            {Object.entries(PROJECT_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-md bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          検索
        </button>
      </div>
      {hasFilters && <Link href="/admin/projects" className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">条件をクリア</Link>}
    </form>
  );
}
