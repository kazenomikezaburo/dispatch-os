export type WorkerLineStatus = {
  linked: boolean;
  status: "unlinked" | "linked_available" | "linked_unavailable" | "suspended";
  externalRemindersEnabled: boolean;
  enabledAt: string | null;
  linkedAt: string | null;
};
