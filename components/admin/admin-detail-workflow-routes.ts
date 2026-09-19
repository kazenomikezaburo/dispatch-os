export type ProjectDetailTab = "overview" | "shifts" | "history";
export type ShiftDetailTab = "overview" | "applications" | "placement" | "confirmation";
export type ShiftOperationPhase = "shift" | "placement" | "pre-shift" | "day-of";

const projectTabs = new Set<ProjectDetailTab>(["overview", "shifts", "history"]);
const shiftTabs = new Set<ShiftDetailTab>(["overview", "applications", "placement", "confirmation"]);

export function parseProjectDetailTab(value: string | string[] | undefined): ProjectDetailTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return projectTabs.has(tab as ProjectDetailTab) ? tab as ProjectDetailTab : "overview";
}

export function parseShiftDetailTab(value: string | string[] | undefined): ShiftDetailTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return shiftTabs.has(tab as ShiftDetailTab) ? tab as ShiftDetailTab : "overview";
}

export function projectDetailHref(projectId: string, tab: ProjectDetailTab = "overview") {
  const base = `/admin/projects/${encodeURIComponent(projectId)}`;
  return tab === "overview" ? base : `${base}?tab=${tab}`;
}

export function shiftDetailHref(shiftId: string, tab: ShiftDetailTab = "overview") {
  const base = `/admin/shifts/${encodeURIComponent(shiftId)}`;
  return tab === "overview" ? base : `${base}?tab=${tab}`;
}

export function shiftWorkflowHrefs(input: { projectId: string; shiftId: string; date: string }) {
  return {
    project: projectDetailHref(input.projectId),
    shift: shiftDetailHref(input.shiftId),
    placement: shiftDetailHref(input.shiftId, "placement"),
    preShift: `/admin/shifts/${encodeURIComponent(input.shiftId)}?tab=confirmation&phase=pre`,
    dayOf: `/admin/shifts/${encodeURIComponent(input.shiftId)}?tab=confirmation&phase=day`,
    attendance: `/admin/attendance?${new URLSearchParams({ date: input.date, shift: input.shiftId }).toString()}`,
  };
}

export function shiftOperationItems(input: { projectId: string; shiftId: string; date: string; active: ShiftOperationPhase }) {
  const hrefs = shiftWorkflowHrefs(input);
  return [
    { key: "shift", label: "シフト", href: hrefs.shift, current: input.active === "shift" },
    { key: "placement", label: "配置・休憩", href: hrefs.placement, current: input.active === "placement" },
    { key: "pre-shift", label: "前日確認", href: hrefs.preShift, current: input.active === "pre-shift" },
    { key: "day-of", label: "当日運用", href: hrefs.dayOf, current: input.active === "day-of" },
  ] as const;
}
