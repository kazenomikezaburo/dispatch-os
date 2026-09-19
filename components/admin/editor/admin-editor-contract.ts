export const PROJECT_EDITOR_SECTIONS = ["基本情報", "期間", "説明・補足"] as const;
export const SHIFT_EDITOR_SECTIONS = ["基本情報", "日程", "勤務条件"] as const;

export const projectEditHref = (projectId: string) => `/admin/projects/${encodeURIComponent(projectId)}?edit=1`;
export const shiftEditHref = (shiftId: string) => `/admin/shifts/${encodeURIComponent(shiftId)}?edit=1`;
export const isEditorMode = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) === "1";
