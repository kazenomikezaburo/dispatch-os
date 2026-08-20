import type { ProjectDetailJob } from "@/lib/admin/projects/project-detail-types";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectJobItem } from "./project-job-item";

export function ProjectJobList({ projectId, jobs }: { projectId: string; jobs: ProjectDetailJob[] }) {
  return <section aria-labelledby="jobs-title"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 id="jobs-title" className="text-lg font-semibold text-slate-950">業務・勤務先</h2><Link href={`/admin/projects/${projectId}/jobs/new`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Plus aria-hidden="true" className="size-4" />業務・勤務先を追加</Link></div>{jobs.length ? <ul className="mt-4 space-y-4">{jobs.map((job) => <ProjectJobItem key={job.id} projectId={projectId} job={job} />)}</ul> : <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-600">この案件にはまだ業務・勤務先が登録されていません。</p>}</section>;
}
