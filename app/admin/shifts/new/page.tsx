import { connection } from "next/server";
import Link from "next/link";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState, AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
import { ShiftCreateEditor } from "@/components/admin/projects/shifts/form/shift-create-editor";
import { ShiftOperationsNav } from "@/components/admin/shifts/shift-operations-nav";
import { getShiftCreateChoices } from "@/lib/admin/projects/get-shift-create-choices";
import { getShiftFormOptions } from "@/lib/admin/projects/get-shift-form-options";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const control = "min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export default async function CanonicalShiftCreatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const raw = await searchParams;
  const rawProjectId = Array.isArray(raw.projectId) ? raw.projectId[0] : raw.projectId;
  const rawJobId = Array.isArray(raw.jobId) ? raw.jobId[0] : raw.jobId;
  const projectId = uuidSchema.safeParse(rawProjectId).success ? rawProjectId : undefined;
  const jobId = uuidSchema.safeParse(rawJobId).success ? rawJobId : undefined;
  const choices = await getShiftCreateChoices(projectId);

  if (!choices.ok) return <AdminPage width="form-wide"><AdminPageHeader title="シフト作成" /><AdminErrorState title="入力項目を取得できませんでした。" /></AdminPage>;

  const selectedProject = choices.projects.find((project) => project.id === projectId);
  const selectedJob = selectedProject ? choices.jobs.find((job) => job.id === jobId && job.projectId === selectedProject.id) : undefined;
  const options = selectedProject && selectedJob ? await getShiftFormOptions(selectedProject.id, selectedJob.id) : null;
  const initialDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return <AdminPage width="form-wide">
    <AdminBreadcrumb items={[{ label: "案件・運用", href: "/admin/projects" }, { label: "シフト運用", href: "/admin/shifts" }, { label: "シフト作成" }]} />
    <AdminPageHeader title="シフト作成" description="案件と、その案件に属する業務・勤務先を選んでシフトを作成します。" />
    <ShiftOperationsNav />
    <section aria-labelledby="shift-create-context" className="rounded-panel border border-border bg-surface p-4 sm:p-6">
      <h2 id="shift-create-context" className="text-lg font-semibold">作成先を選択</h2>
      <p className="mt-1 text-sm text-foreground-muted">案件だけから業務を自動選択しません。作成先の業務を明示してください。</p>
      <form method="get" className="mt-5 grid gap-4 md:grid-cols-[minmax(14rem,1fr)_minmax(16rem,1.4fr)_auto] md:items-end">
        <label className="grid gap-1.5 text-sm font-medium">案件
          <select name="projectId" defaultValue={selectedProject?.id ?? ""} className={control}>
            <option value="">案件を選択</option>
            {choices.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">業務・勤務先
          <select name="jobId" defaultValue={selectedJob?.id ?? ""} disabled={!selectedProject} className={control}>
            <option value="">{selectedProject ? "業務を選択" : "先に案件を選択"}</option>
            {choices.jobs.map((job) => <option key={job.id} value={job.id}>{job.name} — {job.workplaceName}</option>)}
          </select>
        </label>
        <button className="min-h-11 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">選択内容を反映</button>
      </form>
    </section>
    {!selectedProject ? <AdminEmptyState title="案件を選択してください" description="選択後、その案件に属する業務を表示します。" />
      : !selectedJob ? <AdminEmptyState title="業務を選択してください" description={choices.jobs.length ? "作成先の業務・勤務先を明示してください。" : "この案件には選択できる業務がありません。"} />
      : options?.ok ? <ShiftCreateEditor options={options.options} initialDate={initialDate} />
      : <AdminErrorState title="指定した案件と業務を確認できませんでした。"><Link href="/admin/shifts/new" className={adminStateActionClass}>選び直す</Link></AdminErrorState>}
  </AdminPage>;
}
