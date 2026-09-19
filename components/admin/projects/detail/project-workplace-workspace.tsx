import { MasterEditor } from "@/components/admin/masters/master-editor";
import { JobEditDrawer } from "@/components/admin/projects/jobs/job-edit-drawer";
import type { ProjectDetailJob } from "@/lib/admin/projects/project-detail-types";
import type { JobFormOptions } from "@/lib/admin/projects/job-form-types";

export function ProjectWorkplaceWorkspace({ jobs, options }: { jobs: ProjectDetailJob[]; options: JobFormOptions }) {
  const branches = [{ id: options.project.branchId, name: "この案件の支店" }];
  return <section aria-labelledby="project-workplaces-title" className="space-y-5 rounded-panel border border-border bg-surface p-4 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="project-workplaces-title" className="text-lg font-semibold text-foreground">業務・勤務先・会場</h2><p className="mt-1 text-sm text-foreground-muted">対象業務を明示して関連先を変更します。新規登録後は業務編集から関連付けてください。</p></div><MasterEditor kind="workplace" branches={branches} triggerLabel="新しい勤務先・会場を登録" /></div>
    {jobs.length === 0 ? <p className="rounded-control border border-dashed border-border-strong p-5 text-sm text-foreground-muted">業務はまだありません。先に業務を追加してください。</p> : <ul className="divide-y divide-border rounded-control border border-border">{jobs.map((job) => {
      const workplace = options.workplaces.find((item) => item.id === job.workplace.id);
      return <li key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-foreground">{job.name}</p><p className="mt-1 text-sm text-foreground-muted">現在の勤務先・会場：{job.workplace.name} — {job.workplace.address}</p></div><div className="flex flex-wrap gap-2"><JobEditDrawer job={job} options={options} />{workplace ? <MasterEditor kind="workplace" branches={branches} item={workplace} projectContext={{ projectId: options.project.id, jobId: job.id, jobName: job.name }} triggerLabel="勤務先・会場情報を編集" /> : <p className="text-sm text-foreground-muted">現在の勤務先・会場は編集候補にありません。</p>}</div></li>;
    })}</ul>}
  </section>;
}
