import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";
import { ShiftStatusBadge } from "./shift-status-badge";
import { StaffingStatusBadge } from "./staffing-status-badge";

const day = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });

export function ShiftDetailHeader({ detail }: { detail: AdminShiftDetail }) {
  const title = `${day.format(new Date(detail.startsAt))} ${time.format(new Date(detail.startsAt))}〜${time.format(new Date(detail.endsAt))}`;
  return <><AdminBreadcrumb items={[{ label: "シフト管理" }, { label: title }]} /><header><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 font-semibold text-slate-900">{detail.project.name}</p><p className="mt-1 text-sm text-slate-600">{detail.job.name} / {detail.workplace.name}</p></div><div className="flex flex-wrap gap-2"><ShiftStatusBadge status={detail.status} /><StaffingStatusBadge staffingState={detail.staffingState} shortage={detail.shortage} /></div></div></header></>;
}
