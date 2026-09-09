export const OPERATIONAL_INCIDENT_CATEGORIES = [
  "site_access",
  "assignment_instruction",
  "schedule_transport",
  "health_safety",
  "other",
] as const;

export type OperationalIncidentCategory = (typeof OPERATIONAL_INCIDENT_CATEGORIES)[number];
export type OperationalIncidentState = "open" | "acknowledged" | "resolved" | "retracted";

export type WorkerOperationalIncident = {
  id: string;
  assignmentId: string;
  category: OperationalIncidentCategory;
  message: string | null;
  state: OperationalIncidentState;
  version: number;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  retractedAt: string | null;
};

export const incidentCategoryLabels: Record<OperationalIncidentCategory, string> = {
  site_access: "現場・集合場所",
  assignment_instruction: "配置・業務指示",
  schedule_transport: "時間・移動",
  health_safety: "体調・安全",
  other: "その他",
};

export const incidentCategoryDescriptions: Record<OperationalIncidentCategory, string> = {
  site_access: "入口や集合場所が分からない",
  assignment_instruction: "担当場所や作業内容が分からない",
  schedule_transport: "交通遅延や到着が難しい",
  health_safety: "体調や安全について伝えたい",
  other: "そのほかの勤務上の問題",
};

export const incidentStateLabels: Record<OperationalIncidentState, string> = {
  open: "管理者の確認待ち",
  acknowledged: "対応中",
  resolved: "解決済み",
  retracted: "取り下げ済み",
};

export function currentWorkerIncident(incidents: WorkerOperationalIncident[]) {
  return incidents.find((incident) => incident.state === "open" || incident.state === "acknowledged") ?? null;
}

export function terminalWorkerIncidents(incidents: WorkerOperationalIncident[]) {
  return incidents.filter((incident) => incident.state === "resolved" || incident.state === "retracted");
}

export function workerIncidentError(code: string | undefined, operation: "create" | "retract") {
  if (code === "ACTIVE_INCIDENT_EXISTS") return { message: "この勤務には現在対応中のHelp Requestがあります。最新の状態を表示します。", refresh: true };
  if (code === "ASSIGNMENT_NOT_ELIGIBLE") return { message: "この勤務では現在、助けを求める操作を利用できません。", refresh: true };
  if (code === "SHIFT_CANCELLED") return { message: "この勤務はキャンセルされたため、新しいHelp Requestを送信できません。", refresh: true };
  if (code === "VERSION_CONFLICT" || code === "STATE_CONFLICT") return { message: "Help Requestの状態が更新されました。最新の状態を表示します。", refresh: true };
  if (code === "INVALID_CATEGORY") return { message: "困っていることを選択してください。", refresh: false };
  if (code === "INVALID_INPUT") return { message: "入力内容を確認してください。", refresh: false };
  return { message: operation === "create" ? "Help Requestを送信できませんでした。時間をおいて再度お試しください。" : "Help Requestを取り下げられませんでした。時間をおいて再度お試しください。", refresh: false };
}
