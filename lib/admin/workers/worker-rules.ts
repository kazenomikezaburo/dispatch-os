import type { WorkerStatus } from "./worker-types";

export const WORKER_PAGE_SIZE = 20;
export const WORKER_HISTORY_PAGE_SIZE = 20;
export type WorkerListQuery = { q: string; status: "all" | WorkerStatus; page: number };
export type WorkerTab = "overview" | "history" | "profile";

export function parseWorkerListQuery(value: Record<string, string | string[] | undefined>): WorkerListQuery {
  const rawStatus = Array.isArray(value.status) ? value.status[0] : value.status;
  const rawPage = Number(Array.isArray(value.page) ? value.page[0] : value.page);
  const rawQ = Array.isArray(value.q) ? value.q[0] : value.q;
  return {
    q: (rawQ ?? "").trim().slice(0, 100),
    status: rawStatus === "active" || rawStatus === "inactive" || rawStatus === "suspended" ? rawStatus : "all",
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function parseWorkerTab(value?: string | string[]): WorkerTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "history" || tab === "profile" ? tab : "overview";
}

export function parseHistoryPage(value?: string | string[]) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function workerListHref(query: WorkerListQuery, patch: Partial<WorkerListQuery>) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status !== "all") params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));
  const suffix = params.toString();
  return `/admin/workers${suffix ? `?${suffix}` : ""}`;
}

export function workerDetailHref(workerId: string, tab: WorkerTab, historyPage = 1) {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (tab === "history" && historyPage > 1) params.set("historyPage", String(historyPage));
  const suffix = params.toString();
  return `/admin/workers/${workerId}${suffix ? `?${suffix}` : ""}`;
}
