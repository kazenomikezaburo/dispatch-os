import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminErrorState } from "@/components/admin/admin-state";
import { AdminEmptyState, AdminNotFoundState, adminStateActionClass } from "@/components/admin/admin-state";
import { AdminDetailWorkflowNav } from "@/components/admin/admin-detail-workflow-nav";
import { parseShiftDetailTab, shiftDetailHref } from "@/components/admin/admin-detail-workflow-routes";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { isEditorMode } from "@/components/admin/editor/admin-editor-contract";
import { PlacementEditor } from "@/components/admin/placement/placement-editor";
import { CandidatePickerDrawer } from "@/components/admin/placement/candidate-picker-drawer";
import { PlacementFocusRestore } from "@/components/admin/placement/placement-focus-restore";
import { ShiftPlacementSurface } from "@/components/admin/placement/shift-placement-surface";
import { ShiftApplicationList } from "@/components/admin/shifts/shift-application-list";
import { ShiftDetailHeader } from "@/components/admin/shifts/shift-detail-header";
import { ShiftInfoSection } from "@/components/admin/shifts/shift-info-section";
import { ShiftJobConditions } from "@/components/admin/shifts/shift-job-conditions";
import { ConfirmationPhaseNav } from "@/components/admin/shifts/confirmation-phase-nav";
import { PreShiftMonitor } from "@/components/admin/pre-shift/pre-shift-monitor";
import { PreShiftDrawer } from "@/components/admin/pre-shift/pre-shift-drawer";
import { DayOfMonitor } from "@/components/admin/day-of/day-of-monitor";
import { DayOfDrawer } from "@/components/admin/day-of/day-of-drawer";
import { ShiftEditPageForm } from "@/components/admin/shifts/shift-edit-page-form";
import { getPlacementPlan } from "@/lib/admin/placement/get-placement-plan";
import { getShiftCandidates } from "@/lib/admin/staff/get-shift-candidates";
import { getShiftDetail } from "@/lib/admin/shifts/get-shift-detail";
import { getPreShiftMonitor } from "@/lib/admin/pre-shift/get-pre-shift-monitor";
import { getDayOf } from "@/lib/admin/day-of/get-day-of";
import type { PreShiftQuery } from "@/lib/admin/pre-shift/pre-shift-rules";
import type { DayOfQuery } from "@/lib/admin/day-of/day-of-rules";
import { resolveSingleShiftConfirmationPhase, singleShiftConfirmationHref } from "@/lib/admin/shifts/single-shift-confirmation-rules";
import { tokyoDate } from "@/lib/admin/shifts/shift-view-rules";
import { uuidSchema } from "@/lib/utils/uuid-schema";

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function ShiftDetailPage({ params, searchParams }: PageProps<"/admin/shifts/[shiftId]">) {
  const [route, query] = await Promise.all([params, searchParams]);
  const value = uuidSchema.safeParse(route.shiftId);
  if (!value.success) notFound();
  const result = await getShiftDetail(value.data);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) return <AdminPage><AdminErrorState title="シフト詳細を取得できませんでした。" /></AdminPage>;
  const detail = result.detail;

  const requestedTab = first(query.tab);
  if (requestedTab === "assignments") {
    const target = "placement";
    const canonicalQuery = new URLSearchParams({ tab: target });
    const requestedAssignmentId = first(query.assignmentId);
    if (target === "placement" && requestedAssignmentId && detail.assignments.some((item) => item.id === requestedAssignmentId)) canonicalQuery.set("assignmentId", requestedAssignmentId);
    redirect(`/admin/shifts/${encodeURIComponent(detail.id)}?${canonicalQuery.toString()}`);
  }

  if (isEditorMode(query.edit)) {
    const label = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(detail.startsAt));
    return <AdminPage width="form-wide"><AdminBreadcrumb items={[{ label: "シフト運用", href: "/admin/shifts" }, { label, href: `/admin/shifts/${detail.id}` }, { label: "編集" }]} /><AdminPageHeader title="シフトを編集" description="作成画面と同じ項目・順序で、選択した1件のシフトを編集します。" /><ShiftEditPageForm detail={detail} /></AdminPage>;
  }

  const tab = parseShiftDetailTab(query.tab);
  const confirmationPhase = resolveSingleShiftConfirmationPhase(query.phase, detail.startsAt);
  const requestedConfirmationAssignmentId = first(query.assignmentId);
  if (tab === "confirmation" || requestedTab === "confirmations") {
    const allowedKeys = new Set(["tab", "phase", "assignmentId"]);
    const isCanonical = requestedTab === "confirmation" && confirmationPhase.canonical && Object.keys(query).every((key) => allowedKeys.has(key));
    if (!isCanonical) redirect(singleShiftConfirmationHref(detail.id, confirmationPhase.phase, requestedConfirmationAssignmentId));
  }
  const placementPlan = tab === "placement" ? await getPlacementPlan(detail.id) : null;
  const requestedAssignmentId = first(query.assignmentId);
  const placementHref = shiftDetailHref(detail.id, "placement");
  const candidateOpen = tab === "placement" && first(query.candidate) === "picker";
  const assignmentId = placementPlan && requestedAssignmentId && placementPlan.assignments.some((item) => item.assignmentId === requestedAssignmentId) ? requestedAssignmentId : null;
  const placementMode = candidateOpen ? null : first(query.placement) === "create" ? "create" : assignmentId ? "edit" : null;
  const candidateResult = candidateOpen ? await getShiftCandidates(detail.id) : null;
  const candidateHref = `${placementHref}&candidate=picker`;
  const shiftDate = tokyoDate(detail.startsAt);
  const confirmationHref = singleShiftConfirmationHref(detail.id, confirmationPhase.phase);
  const preQuery: PreShiftQuery = { date: shiftDate, q: "", project: "", shift: detail.id, status: "all", assignment: "" };
  const dayQuery: DayOfQuery = { date: shiftDate, q: "", project: "", shift: detail.id, state: "all", assignment: "" };
  const preResult = tab === "confirmation" && confirmationPhase.phase === "pre" ? await getPreShiftMonitor(shiftDate, detail.id) : null;
  const dayResult = tab === "confirmation" && confirmationPhase.phase === "day" ? await getDayOf(dayQuery, new Date(), detail.id) : null;
  const preItems = preResult?.ok ? preResult.items : [];
  const dayItems = dayResult?.ok ? dayResult.items : [];
  const preSelected = requestedConfirmationAssignmentId ? preItems.find((item) => item.assignmentId === requestedConfirmationAssignmentId) : undefined;
  const daySelected = requestedConfirmationAssignmentId ? dayItems.find((item) => item.assignmentId === requestedConfirmationAssignmentId) : undefined;

  return <AdminPage>
    <ShiftDetailHeader detail={detail} />
    <AdminDetailWorkflowNav label="シフト詳細" items={[
      { label: "概要", href: shiftDetailHref(detail.id), current: tab === "overview" },
      { label: "応募", href: shiftDetailHref(detail.id, "applications"), current: tab === "applications" },
      { label: "配置", href: placementHref, current: tab === "placement" },
      { label: "確認", href: confirmationHref, current: tab === "confirmation" },
    ]} />
    {tab === "overview" && <div className="space-y-6"><section aria-label="シフトサマリー" className="grid gap-3 sm:grid-cols-4">{[
      ["必要人数", detail.requiredWorkers], ["配置済み", detail.assignedWorkers], ["応募", detail.applicationCount], ["不足", detail.shortage],
    ].map(([label, metric]) => <div key={label} className="rounded-card border border-border bg-surface p-4"><p className="text-xs font-medium text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{metric}<span className="ml-1 text-xs font-normal">名</span></p></div>)}</section><div className="grid gap-6 xl:grid-cols-2"><ShiftInfoSection detail={detail} /><ShiftJobConditions detail={detail} /></div></div>}
    {tab === "applications" && <ShiftApplicationList shiftId={detail.id} applications={detail.applications} assignedWorkers={detail.assignedWorkers} requiredWorkers={detail.requiredWorkers} />}
    {tab === "placement" && (placementPlan ? <><PlacementFocusRestore enabled={!placementMode && !candidateOpen} /><ShiftPlacementSurface plan={placementPlan} baseHref={placementHref} candidateHref={candidateHref} />{placementMode && <PlacementEditor initial={placementPlan} closeHref={placementHref} shiftLabel={`${detail.project.name} / ${detail.job.name}`} assignmentId={assignmentId} returnFocusId={placementMode === "create" ? "placement-create-trigger" : `placement-assignment-${assignmentId}`} />}{candidateOpen && <CandidatePickerDrawer shiftId={detail.id} candidates={candidateResult?.ok ? candidateResult.items : []} truncated={candidateResult?.ok ? candidateResult.truncated : false} loadError={!candidateResult?.ok} closeHref={placementHref} shiftLabel={`${detail.project.name} / ${detail.job.name}`} />}</> : <AdminErrorState title="配置プランを取得できませんでした。"><Link href={placementHref}>再読み込み</Link></AdminErrorState>)}
    {tab === "confirmation" && <div className="space-y-5"><ConfirmationPhaseNav shiftId={detail.id} phase={confirmationPhase.phase} />
      {confirmationPhase.phase === "pre" ? !preResult?.ok ? <AdminErrorState title="前日確認を取得できませんでした。" /> : preItems.length === 0 ? <AdminEmptyState title="このシフトの対象スタッフはいません。" description="配置済みスタッフが追加されると、ここに確認状況が表示されます。" /> : <PreShiftMonitor items={preItems} query={preQuery} assignmentHref={(id) => singleShiftConfirmationHref(detail.id, "pre", id)} /> : !dayResult?.ok ? <AdminErrorState title="当日確認を取得できませんでした。" /> : dayItems.length === 0 ? <AdminEmptyState title="このシフトの対象スタッフはいません。" description="配置済みスタッフが追加されると、ここに勤務状態が表示されます。" /> : <DayOfMonitor items={dayItems} query={dayQuery} assignmentHref={(id) => singleShiftConfirmationHref(detail.id, "day", id)} />}
      {requestedConfirmationAssignmentId && (confirmationPhase.phase === "pre" ? preSelected ? <PreShiftDrawer item={preSelected} closeHref={confirmationHref} /> : <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--surface-overlay)] p-4"><AdminNotFoundState><Link href={confirmationHref} className={adminStateActionClass}>確認へ戻る</Link></AdminNotFoundState></div> : daySelected ? <DayOfDrawer item={daySelected} date={shiftDate} closeHref={confirmationHref} /> : <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--surface-overlay)] p-4"><AdminNotFoundState><Link href={confirmationHref} className={adminStateActionClass}>確認へ戻る</Link></AdminNotFoundState></div>)}
    </div>}
  </AdminPage>;
}
