import type { ProjectListItem } from "@/lib/admin/projects/project-types";
import { AdminKpiCard, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

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
      tone: "info",
      description: "現在稼働している案件",
    },
    {
      label: "要確認",
      value: projects.filter((project) => project.shortage > 0).length,
      tone: "warning",
      description: "配置不足がある案件",
    },
    {
      label: "今週開始",
      value: projects.filter((project) => project.startDate >= week.start && project.startDate < week.end).length,
      tone: "success",
      description: "今週開始する案件",
    },
  ];

  return (
    <section aria-label="案件サマリー" className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <AdminKpiCard key={item.label} label={item.label} value={item.value} unit="件" description={item.description} tone={item.tone as AdminVisualTone} />
      ))}
    </section>
  );
}
