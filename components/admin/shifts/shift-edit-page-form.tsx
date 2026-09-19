"use client";

import { useRouter } from "next/navigation";
import { updateShift } from "@/app/actions/shifts";
import { ShiftForm } from "@/components/admin/projects/shifts/form/shift-create-form";
import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";
import { buildShiftEditModel } from "@/components/admin/editor/admin-editor-values";

export function ShiftEditPageForm({ detail }: { detail: AdminShiftDetail }) {
  const router = useRouter();
  const { values, options } = buildShiftEditModel(detail);
  const href = `/admin/shifts/${detail.id}`;
  return <ShiftForm key={detail.updatedAt} mode="edit" options={options} initialValues={values} shiftId={detail.id} expectedUpdatedAt={detail.updatedAt} restrictions={detail.editRestrictions} cancelHref={href} submitAction={async (_projectId, _jobId, input) => updateShift(input)} onConflict={() => router.refresh()} onSuccess={() => { router.push(href); router.refresh(); }} />;
}
