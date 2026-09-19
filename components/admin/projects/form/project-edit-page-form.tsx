"use client";

import { useRouter } from "next/navigation";
import type { ProjectDetail } from "@/lib/admin/projects/project-detail-types";
import type { ProjectFormOptions } from "@/lib/admin/projects/project-form-types";
import { buildProjectEditInitialValues } from "@/components/admin/editor/admin-editor-values";
import { ProjectForm } from "./project-create-form";

export function ProjectEditPageForm({ project, options }: { project: ProjectDetail; options: ProjectFormOptions }) {
  const router = useRouter();
  const href = `/admin/projects/${project.id}`;
  return <ProjectForm
    key={project.updatedAt}
    mode="edit"
    options={options}
    projectId={project.id}
    expectedUpdatedAt={project.updatedAt}
    cancelHref={href}
    initialValues={buildProjectEditInitialValues(project)}
    onSuccess={() => { router.push(href); router.refresh(); }}
    onReloadLatest={() => router.refresh()}
  />;
}
