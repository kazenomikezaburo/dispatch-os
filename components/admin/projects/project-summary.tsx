import type { ProjectListItem } from "@/lib/admin/projects/project-types";

function getTokyoWeekRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const today = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  const dayFromMonday = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - dayFromMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return { start: format(start), end: format(end) };
}

export function ProjectSummary({ projects }: { projects: ProjectListItem[] }) {
  const week = getTokyoWeekRange();
  const items = [
    {
      label: "進行中",
      value: projects.filter((project) => project.status === "in_progress").length,
      accent: "text-blue-700",
    },
    {
      label: "要確認",
      value: projects.filter((project) => project.shortage > 0).length,
      accent: "text-amber-700",
    },
    {
      label: "今週開始",
      value: projects.filter((project) => project.startDate >= week.start && project.startDate < week.end).length,
      accent: "text-emerald-700",
    },
  ];

  return (
    <section aria-label="案件サマリー" className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <article key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold text-slate-500">{item.label}</p>
          <p className={`mt-2 text-2xl font-semibold tracking-tight ${item.accent}`}>{item.value}<span className="ml-1 text-sm font-medium text-slate-500">件</span></p>
        </article>
      ))}
    </section>
  );
}
