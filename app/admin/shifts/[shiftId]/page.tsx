import { notFound } from "next/navigation";
import { AdminErrorState } from "@/components/admin/admin-state";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { AdminPage } from "@/components/admin/admin-page";
import { ShiftApplicationList } from "@/components/admin/shifts/shift-application-list";
import { ShiftAssignmentList } from "@/components/admin/shifts/shift-assignment-list";
import { ShiftDetailHeader } from "@/components/admin/shifts/shift-detail-header";
import { ShiftDetailSummary } from "@/components/admin/shifts/shift-detail-summary";
import { ShiftInfoSection } from "@/components/admin/shifts/shift-info-section";
import { ShiftJobConditions } from "@/components/admin/shifts/shift-job-conditions";
import { PreShiftConfirmationSection } from "@/components/admin/shifts/pre-shift-confirmation-section";
import { getShiftDetail } from "@/lib/admin/shifts/get-shift-detail";
import { uuidSchema } from "@/lib/utils/uuid-schema";

export default async function ShiftDetailPage({ params }: PageProps<"/admin/shifts/[shiftId]">) {
  const value = uuidSchema.safeParse((await params).shiftId);
  if (!value.success) notFound();
  const result = await getShiftDetail(value.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <AdminPage><AdminErrorState title="シフト詳細を取得できませんでした。" /></AdminPage>;
  const detail = result.detail;
  return <AdminPage><ShiftDetailHeader detail={detail} />
    <AdminSectionNav label="シフト内のセクション" items={[{ label: "概要", href: "#shift-overview" }, { label: "応募", href: "#shift-applications" }, { label: "配置", href: "#shift-assignments" }, { label: "事前確認", href: "#shift-confirmations" }]} />
    <ShiftDetailSummary detail={detail} />
    <div id="shift-overview" className="grid scroll-mt-24 gap-6 xl:grid-cols-2"><ShiftInfoSection detail={detail} /><ShiftJobConditions detail={detail} /></div>
    <div id="shift-applications" className="scroll-mt-24"><ShiftApplicationList shiftId={detail.id} applications={detail.applications} assignedWorkers={detail.assignedWorkers} requiredWorkers={detail.requiredWorkers} /></div>
    <div id="shift-assignments" className="scroll-mt-24"><ShiftAssignmentList shiftId={detail.id} startsAt={detail.startsAt} assignments={detail.assignments} /></div>
    <div id="shift-confirmations" className="scroll-mt-24"><PreShiftConfirmationSection summary={detail.preShiftConfirmations} /></div>
  </AdminPage>;
}
