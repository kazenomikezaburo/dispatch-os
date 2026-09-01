import type { ProjectDetail, ProjectDetailJob } from "@/lib/admin/projects/project-detail-types";
import type { JobFormOptions } from "@/lib/admin/projects/job-form-types";
import { JobCreateDrawer } from "@/components/admin/projects/jobs/job-create-drawer";
import { ProjectJobItem } from "./project-job-item";

export function ProjectJobList({ project, jobs, formOptions }: { project: Pick<ProjectDetail, "id" | "name" | "status">; jobs: ProjectDetailJob[]; formOptions?: JobFormOptions }) {
  const createHref = `/admin/projects/${project.id}/jobs/new`;
  return <JobCreateDrawer options={formOptions} createHref={createHref} hasJobs={jobs.length > 0} jobCount={jobs.length}>{jobs.length > 0 && <ul className="mt-5 overflow-hidden rounded-lg border border-slate-200">{jobs.map((job) => <ProjectJobItem key={job.id} project={project} job={job} formOptions={formOptions} />)}</ul>}</JobCreateDrawer>;
}
