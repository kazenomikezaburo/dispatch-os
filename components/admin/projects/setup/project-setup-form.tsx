"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createProjectInline } from "@/app/actions/projects";
import { createJobInline } from "@/app/actions/jobs";
import { saveClient } from "@/app/actions/clients";
import { saveWorkplace } from "@/app/actions/workplaces";
import { AdminEditorSection } from "@/components/admin/editor/admin-editor-layout";
import { AdminFeedback } from "@/components/admin/admin-state";
import { PROJECT_STATUS_LABELS } from "@/lib/admin/projects/project-rules";
import { PROJECT_STATUSES } from "@/lib/admin/projects/project-types";
import { JOB_STATUS_LABELS } from "@/lib/admin/projects/project-detail-rules";
import { JOB_STATUSES, jobFormSchema, type JobFormValues } from "@/lib/admin/projects/job-form-schema";
import { projectFormSchema, type ProjectFormInput } from "@/lib/admin/projects/project-form-schema";
import type { ProjectFormOptions } from "@/lib/admin/projects/project-form-types";
import type { ProjectSetupWorkplaceOption } from "@/lib/admin/projects/get-project-form-options";

const controlClass = "mt-1.5 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-focus-ring focus:ring-2 focus:ring-info-subtle disabled:cursor-not-allowed disabled:bg-surface-muted";
type Errors = Record<string, string | undefined>;

export function ProjectSetupForm({ options, initialWorkplaces }: { options: ProjectFormOptions; initialWorkplaces: ProjectSetupWorkplaceOption[] }) {
  const router = useRouter();
  const defaultBranch = options.branches[0]?.id ?? "";
  const [project, setProject] = useState<ProjectFormInput>({ name: "", branch_id: defaultBranch, client_id: options.clients.find((item) => item.branchId === defaultBranch)?.id ?? "", start_date: "", end_date: "", status: "draft", description: "" });
  const [clients, setClients] = useState(options.clients);
  const [workplaces, setWorkplaces] = useState(initialWorkplaces);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [workplaceMode, setWorkplaceMode] = useState<"existing" | "new">("existing");
  const [newClient, setNewClient] = useState({ name: "", note: "" });
  const [newWorkplace, setNewWorkplace] = useState({ name: "", postalCode: "", address: "", defaultTransportNote: "", accessNote: "", meetingNote: "" });
  const [includeJob, setIncludeJob] = useState(true);
  const [job, setJob] = useState<JobFormValues>({ name: "", workplace_id: initialWorkplaces.find((item) => item.branchId === defaultBranch)?.id ?? "", status: "draft", description: "", hourly_wage: "", transportation_fee_cap: "", dress_code: "", requirements: "", meal_notes: "", recruitment_notes: "", manual_url: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string>();
  const [messageKind, setMessageKind] = useState<"error" | "success" | "unsaved">("error");
  const [busy, setBusy] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string>();
  const branchClients = useMemo(() => clients.filter((item) => item.branchId === project.branch_id), [clients, project.branch_id]);
  const branchWorkplaces = useMemo(() => workplaces.filter((item) => item.branchId === project.branch_id), [workplaces, project.branch_id]);

  const patchProject = <K extends keyof ProjectFormInput>(key: K, value: ProjectFormInput[K]) => setProject((current) => ({ ...current, [key]: value }));
  const patchJob = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) => setJob((current) => ({ ...current, [key]: value }));
  const changeBranch = (branchId: string) => {
    const nextClients = clients.filter((item) => item.branchId === branchId);
    const nextWorkplaces = workplaces.filter((item) => item.branchId === branchId);
    setProject((current) => ({ ...current, branch_id: branchId, client_id: nextClients[0]?.id ?? "" }));
    setJob((current) => ({ ...current, workplace_id: nextWorkplaces[0]?.id ?? "" }));
  };

  const createInlineClient = async () => {
    if (busy) return;
    setBusy(true); setErrors({}); setMessage(undefined); setMessageKind("error");
    const result = await saveClient({ branchId: project.branch_id, name: newClient.name, note: newClient.note, isActive: true });
    if (result.ok) {
      const item = { id: result.id, branchId: project.branch_id, name: newClient.name.trim() };
      setClients((current) => [...current, item]); patchProject("client_id", result.id); setClientMode("existing"); setMessageKind("success"); setMessage("取引先を正式なマスタとして登録し、この案件に選択しました。");
    } else { setErrors(result.fieldErrors ?? {}); setMessage(result.message); }
    setBusy(false);
  };

  const createInlineWorkplace = async () => {
    if (busy) return;
    setBusy(true); setErrors({}); setMessage(undefined); setMessageKind("error");
    const result = await saveWorkplace({ branchId: project.branch_id, ...newWorkplace, isActive: true });
    if (result.ok) {
      const item = { id: result.id, branchId: project.branch_id, name: newWorkplace.name.trim(), address: newWorkplace.address.trim() };
      setWorkplaces((current) => [...current, item]); patchJob("workplace_id", result.id); setWorkplaceMode("existing"); setMessageKind("success"); setMessage("勤務先を正式なマスタとして登録し、初期業務に選択しました。");
    } else { setErrors(result.fieldErrors ?? {}); setMessage(result.message); }
    setBusy(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErrors({}); setMessage(undefined); setMessageKind("error");
    const projectParsed = projectFormSchema.safeParse(project);
    const jobParsed = includeJob ? jobFormSchema.safeParse(job) : undefined;
    if (!projectParsed.success || (jobParsed && !jobParsed.success)) {
      const next: Errors = {};
      for (const issue of projectParsed.success ? [] : projectParsed.error.issues) next[`project.${String(issue.path[0])}`] ??= issue.message;
      if (jobParsed && !jobParsed.success) for (const issue of jobParsed.error.issues) next[`job.${String(issue.path[0])}`] ??= issue.message;
      setErrors(next); setMessage("入力内容を確認してください。");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setBusy(true);
    let projectId = createdProjectId;
    if (!projectId) {
      const projectResult = await createProjectInline(projectParsed.data);
      if (!projectResult.ok) {
        setErrors(Object.fromEntries(Object.entries(projectResult.fieldErrors ?? {}).map(([key, value]) => [`project.${key}`, value]))); setMessage(projectResult.message ?? "案件を作成できませんでした。"); setBusy(false); return;
      }
      projectId = projectResult.projectId; setCreatedProjectId(projectId);
    }
    if (includeJob && jobParsed?.success) {
      const jobResult = await createJobInline(projectId, jobParsed.data);
      if (!jobResult.ok) {
        setErrors(Object.fromEntries(Object.entries(jobResult.fieldErrors ?? {}).map(([key, value]) => [`job.${key}`, value]))); setMessageKind("unsaved"); setMessage("案件は作成済みです。業務の入力を確認して、業務だけを再試行してください。"); setBusy(false); return;
      }
    }
    router.push(`/admin/projects/${projectId}`); router.refresh();
  };

  const error = (key: string) => errors[key];
  return <form onSubmit={submit} noValidate className="space-y-6">
    {message && <AdminFeedback kind={messageKind} message={message} />}
    {createdProjectId && <AdminFeedback kind="unsaved" message="案件は作成済みです。再送信では案件を重複作成せず、初期業務だけを作成します。" />}
    <fieldset disabled={busy || Boolean(createdProjectId)} className="min-w-0 space-y-6">
      <AdminEditorSection id="setup-project" title="1. 案件情報" description="案件の管理範囲、期間、状態を設定します。">
        <div className="grid gap-5 sm:grid-cols-2"><Field label="案件名" required error={error("project.name")}><input value={project.name} onChange={(e) => patchProject("name", e.target.value)} maxLength={100} aria-invalid={Boolean(error("project.name"))} className={controlClass} /></Field><Field label="支店" required error={error("project.branch_id")}><select value={project.branch_id} onChange={(e) => changeBranch(e.target.value)} className={controlClass}>{options.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="開始日" required error={error("project.start_date")}><input type="date" value={project.start_date} onChange={(e) => patchProject("start_date", e.target.value)} aria-invalid={Boolean(error("project.start_date"))} className={controlClass} /></Field><Field label="終了日" required error={error("project.end_date")}><input type="date" value={project.end_date} onChange={(e) => patchProject("end_date", e.target.value)} aria-invalid={Boolean(error("project.end_date"))} className={controlClass} /></Field></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="状態" required><select value={project.status} onChange={(e) => patchProject("status", e.target.value as ProjectFormInput["status"])} className={controlClass}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}</select></Field><Field label="説明"><textarea value={project.description} onChange={(e) => patchProject("description", e.target.value)} rows={3} maxLength={2000} className={controlClass} /></Field></div>
      </AdminEditorSection>
      <AdminEditorSection id="setup-client" title="2. 取引先" description="既存の取引先を選ぶか、正式な取引先マスタを登録します。">
        <ModeChoice name="client-mode" value={clientMode} onChange={setClientMode} existingLabel="既存から選択" newLabel="新しい取引先を登録" />
        {clientMode === "existing" ? <Field label="取引先" required error={error("project.client_id")}><select value={project.client_id} onChange={(e) => patchProject("client_id", e.target.value)} aria-invalid={Boolean(error("project.client_id"))} className={controlClass}><option value="">選択してください</option>{branchClients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : <div className="mt-4 space-y-4 rounded-control border border-border bg-surface-muted p-4" aria-label="新しい取引先"><Field label="取引先名" required error={error("name")}><input value={newClient.name} onChange={(e) => setNewClient((v) => ({ ...v, name: e.target.value }))} aria-invalid={Boolean(error("name"))} className={controlClass} /></Field><Field label="補足" error={error("note")}><textarea value={newClient.note} onChange={(e) => setNewClient((v) => ({ ...v, note: e.target.value }))} rows={3} className={controlClass} /></Field><p className="text-xs text-foreground-muted">登録すると正式な取引先マスタになります。案件作成をキャンセルしても削除されません。</p><button type="button" onClick={createInlineClient} disabled={busy} className="min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium">取引先を登録して選択</button></div>}
      </AdminEditorSection>
    </fieldset>
    <fieldset disabled={busy} className="min-w-0 space-y-6">
      <AdminEditorSection id="setup-job" title="3. 業務" description="初期業務は任意です。後から案件詳細でも追加できます。">
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={includeJob} onChange={(e) => setIncludeJob(e.target.checked)} disabled={Boolean(createdProjectId)} /> 初期業務をこの画面で作成する</label>
        {includeJob && <div className="mt-4 space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="業務名" required error={error("job.name")}><input value={job.name} onChange={(e) => patchJob("name", e.target.value)} aria-invalid={Boolean(error("job.name"))} className={controlClass} /></Field><Field label="状態" required><select value={job.status} onChange={(e) => patchJob("status", e.target.value as JobFormValues["status"])} className={controlClass}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{JOB_STATUS_LABELS[status]}</option>)}</select></Field></div><Field label="仕事内容" error={error("job.description")}><textarea value={job.description ?? ""} onChange={(e) => patchJob("description", e.target.value)} rows={4} className={controlClass} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="時給" error={error("job.hourly_wage")}><input type="number" min="0" value={job.hourly_wage ?? ""} onChange={(e) => patchJob("hourly_wage", e.target.value)} className={controlClass} /></Field><Field label="交通費上限" error={error("job.transportation_fee_cap")}><input type="number" min="0" value={job.transportation_fee_cap ?? ""} onChange={(e) => patchJob("transportation_fee_cap", e.target.value)} className={controlClass} /></Field></div><Field label="服装"><textarea value={job.dress_code ?? ""} onChange={(e) => patchJob("dress_code", e.target.value)} rows={3} className={controlClass} /></Field><Field label="応募条件"><textarea value={job.requirements ?? ""} onChange={(e) => patchJob("requirements", e.target.value)} rows={3} className={controlClass} /></Field><Field label="食事案内"><textarea value={job.meal_notes ?? ""} onChange={(e) => patchJob("meal_notes", e.target.value)} rows={2} className={controlClass} /></Field><Field label="募集補足"><textarea value={job.recruitment_notes ?? ""} onChange={(e) => patchJob("recruitment_notes", e.target.value)} rows={2} className={controlClass} /></Field><Field label="業務資料URL" error={error("job.manual_url")}><input type="url" value={job.manual_url ?? ""} onChange={(e) => patchJob("manual_url", e.target.value)} className={controlClass} /></Field></div>}
      </AdminEditorSection>
      {includeJob && <AdminEditorSection id="setup-workplace" title="4. 勤務先" description="初期業務で使用する既存勤務先を選ぶか、正式な勤務先マスタを登録します。">
        <ModeChoice name="workplace-mode" value={workplaceMode} onChange={setWorkplaceMode} existingLabel="既存から選択" newLabel="新しい勤務先を登録" />
        {workplaceMode === "existing" ? <Field label="勤務先" required error={error("job.workplace_id")}><select value={String(job.workplace_id ?? "")} onChange={(e) => patchJob("workplace_id", e.target.value)} aria-invalid={Boolean(error("job.workplace_id"))} className={controlClass}><option value="">選択してください</option>{branchWorkplaces.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.address}</option>)}</select></Field> : <div className="mt-4 grid gap-4 rounded-control border border-border bg-surface-muted p-4 sm:grid-cols-2" aria-label="新しい勤務先"><Field label="勤務先名" required error={error("name")}><input value={newWorkplace.name} onChange={(e) => setNewWorkplace((v) => ({ ...v, name: e.target.value }))} aria-invalid={Boolean(error("name"))} className={controlClass} /></Field><Field label="郵便番号" error={error("postalCode")}><input value={newWorkplace.postalCode} onChange={(e) => setNewWorkplace((v) => ({ ...v, postalCode: e.target.value }))} className={controlClass} /></Field><div className="sm:col-span-2"><Field label="住所" required error={error("address")}><input value={newWorkplace.address} onChange={(e) => setNewWorkplace((v) => ({ ...v, address: e.target.value }))} aria-invalid={Boolean(error("address"))} className={controlClass} /></Field></div><Field label="交通案内"><textarea value={newWorkplace.defaultTransportNote} onChange={(e) => setNewWorkplace((v) => ({ ...v, defaultTransportNote: e.target.value }))} rows={2} className={controlClass} /></Field><Field label="アクセス補足"><textarea value={newWorkplace.accessNote} onChange={(e) => setNewWorkplace((v) => ({ ...v, accessNote: e.target.value }))} rows={2} className={controlClass} /></Field><div className="sm:col-span-2"><Field label="集合場所"><textarea value={newWorkplace.meetingNote} onChange={(e) => setNewWorkplace((v) => ({ ...v, meetingNote: e.target.value }))} rows={2} className={controlClass} /></Field><p className="mt-2 text-xs text-foreground-muted">登録すると正式な勤務先マスタになります。案件作成をキャンセルしても削除されません。</p><button type="button" onClick={createInlineWorkplace} disabled={busy} className="mt-3 min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium">勤務先を登録して選択</button></div></div>}
      </AdminEditorSection>}
      <AdminEditorSection id="setup-confirm" title="5. 作成内容の確認" description="保存されるDomain間の参照を確認してください。"><dl className="grid gap-4 text-sm sm:grid-cols-2"><Summary label="案件" value={project.name || "未入力"} /><Summary label="取引先" value={branchClients.find((item) => item.id === project.client_id)?.name ?? "未選択"} /><Summary label="初期業務" value={includeJob ? job.name || "未入力" : "後で追加"} /><Summary label="勤務先" value={includeJob ? branchWorkplaces.find((item) => item.id === job.workplace_id)?.name ?? "未選択" : "対象外"} /></dl><p className="mt-4 text-xs text-foreground-muted">シフトは作成されません。案件作成後、案件詳細の業務から既存フローで追加します。</p></AdminEditorSection>
    </fieldset>
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-background/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-foreground-muted">保存後は案件詳細の概要へ移動します。</p><div className="flex flex-col-reverse gap-3 sm:flex-row"><Link href="/admin/projects" className="inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-sm font-medium">キャンセル</Link><button type="submit" disabled={busy || clientMode === "new" || (includeJob && workplaceMode === "new")} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-disabled">{busy ? "作成中..." : createdProjectId ? "業務を再試行" : "案件を作成"}</button></div></div>
  </form>;
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-foreground">{label}{required && <span className="ml-1 text-danger">*</span>}{children}{error && <span role="alert" className="mt-1.5 block text-sm text-danger">{error}</span>}</label>; }
function ModeChoice({ name, value, onChange, existingLabel, newLabel }: { name: string; value: "existing" | "new"; onChange: (value: "existing" | "new") => void; existingLabel: string; newLabel: string }) { return <fieldset className="mb-4"><legend className="sr-only">登録方法</legend><div className="flex flex-col gap-2 sm:flex-row sm:gap-6"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={name} checked={value === "existing"} onChange={() => onChange("existing")} />{existingLabel}</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={name} checked={value === "new"} onChange={() => onChange("new")} />{newLabel}</label></div></fieldset>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><dt className="text-foreground-muted">{label}</dt><dd className="mt-1 break-words font-medium text-foreground">{value}</dd></div>; }
