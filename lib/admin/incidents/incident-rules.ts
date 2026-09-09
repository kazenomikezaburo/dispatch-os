import { OPERATIONAL_INCIDENT_CATEGORIES, type OperationalIncidentCategory } from "@/lib/worker/incidents/worker-incident-ui";
import type { AdminIncident, AdminIncidentQuery, AdminIncidentStateFilter } from "./incident-types";

export const ADMIN_INCIDENT_PAGE_SIZE = 20;
const states: AdminIncidentStateFilter[] = ["unresolved", "open", "acknowledged", "resolved", "retracted", "all"];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseAdminIncidentQuery(raw: Record<string, string | string[] | undefined>): AdminIncidentQuery {
  const state = first(raw.state);
  const category = first(raw.category);
  const page = Number.parseInt(first(raw.page), 10);
  return {
    state: states.includes(state as AdminIncidentStateFilter) ? state as AdminIncidentStateFilter : "unresolved",
    category: OPERATIONAL_INCIDENT_CATEGORIES.includes(category as OperationalIncidentCategory) ? category as OperationalIncidentCategory : "",
    q: first(raw.q).trim().slice(0, 100),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    incident: first(raw.incident),
  };
}

export function adminIncidentHref(query: AdminIncidentQuery, patch: Partial<AdminIncidentQuery> = {}) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.state !== "unresolved") params.set("state", next.state);
  if (next.category) params.set("category", next.category);
  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.incident) params.set("incident", next.incident);
  const suffix = params.toString();
  return `/admin/incidents${suffix ? `?${suffix}` : ""}`;
}

export function filterAndSortAdminIncidents(incidents: AdminIncident[], query: AdminIncidentQuery) {
  const needle = query.q.toLocaleLowerCase("ja");
  const filtered = incidents.filter((incident) => {
    const stateMatch = query.state === "all" || (query.state === "unresolved" ? incident.state === "open" || incident.state === "acknowledged" : incident.state === query.state);
    const searchMatch = !needle || [incident.workerName, incident.staffCode, incident.projectName, incident.jobName, incident.workplaceName].some((value) => value.toLocaleLowerCase("ja").includes(needle));
    return stateMatch && (!query.category || incident.category === query.category) && searchMatch;
  });
  filtered.sort((a, b) => {
    if (query.state === "unresolved") {
      const rank = (state: AdminIncident["state"]) => state === "open" ? 0 : 1;
      return rank(a.state) - rank(b.state) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    }
    const terminal = query.state === "resolved" || query.state === "retracted" || query.state === "all";
    return terminal ? b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id) : a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
  return filtered;
}

export function paginateAdminIncidents(items: AdminIncident[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / ADMIN_INCIDENT_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  return { page, totalPages, total: items.length, items: items.slice((page - 1) * ADMIN_INCIDENT_PAGE_SIZE, page * ADMIN_INCIDENT_PAGE_SIZE) };
}
