import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import Link from "next/link";
import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";
import { ShiftStatusBadge } from "./shift-status-badge";
import { StaffingStatusBadge } from "./staffing-status-badge";
import { ShiftEditDrawer } from "./shift-edit-drawer";

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });

export function ShiftDetailHeader({ detail }: { detail: AdminShiftDetail }) {
  const title = `${day.format(new Date(detail.startsAt))} ${time.format(new Date(detail.startsAt))}〜${time.format(new Date(detail.endsAt))}`;
  return <><AdminBreadcrumb items={[{ label: "シフト", href: "/admin/shifts" }, { label: title }]} /><header><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 break-words"><h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1><Link href={`/admin/projects/${detail.project.id}`} className="mt-2 inline-flex min-h-11 items-center font-semibold text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">{detail.project.name}</Link><p className="mt-1 text-sm text-foreground-secondary">{detail.job.name} / {detail.workplace.name}</p></div><div className="flex flex-wrap items-center gap-2 sm:max-w-sm sm:justify-end"><ShiftStatusBadge status={detail.status} /><StaffingStatusBadge staffingState={detail.staffingState} shortage={detail.shortage} /><ShiftEditDrawer detail={detail} /></div></div></header></>;
}
