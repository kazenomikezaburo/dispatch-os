import { notFound } from "next/navigation";
import { z } from "zod";
import { AttendanceDetailView } from "@/components/admin/attendance/attendance-detail-view";
import { getAttendanceDetail } from "@/lib/admin/attendance/get-attendance-detail";

export default async function AttendanceDetailPage({ params }: PageProps<"/admin/attendance/[assignmentId]">) {
  const idSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const id = idSchema.safeParse((await params).assignmentId);
  if (!id.success) notFound();
  const result = await getAttendanceDetail(id.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <section role="alert" className="rounded-lg border border-red-200 bg-white p-5"><h1 className="font-semibold">勤怠詳細を取得できませんでした。</h1><p className="mt-1 text-sm text-slate-600">時間をおいて再度お試しください。</p></section>;
  return <AttendanceDetailView detail={result.detail} />;
}
