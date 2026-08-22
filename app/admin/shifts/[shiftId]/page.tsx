import { notFound } from "next/navigation";
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
  if (!result.ok) return <section role="alert" className="rounded-lg border border-red-200 bg-white p-5"><h1 className="font-semibold text-slate-950">シフト詳細を取得できませんでした。</h1><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></section>;
  const detail = result.detail;
  return <div className="space-y-6"><ShiftDetailHeader detail={detail} /><ShiftDetailSummary detail={detail} /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.7fr)]"><div className="space-y-6"><ShiftInfoSection detail={detail} /><ShiftJobConditions detail={detail} /></div><div className="space-y-6"><ShiftApplicationList shiftId={detail.id} applications={detail.applications} assignedWorkers={detail.assignedWorkers} requiredWorkers={detail.requiredWorkers} /><ShiftAssignmentList shiftId={detail.id} startsAt={detail.startsAt} assignments={detail.assignments} /><PreShiftConfirmationSection summary={detail.preShiftConfirmations} /></div></div></div>;
}
