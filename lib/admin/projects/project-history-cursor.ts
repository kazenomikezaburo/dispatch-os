import type { ProjectHistoryCursor } from "./project-history-types";

type CursorEnvelope = { createdAt: unknown; id: unknown };

export function encodeProjectHistoryCursor(cursor: ProjectHistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function parseProjectHistoryCursor(value: string | string[] | undefined): ProjectHistoryCursor | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw.length > 512) return null;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as CursorEnvelope;
    if (typeof decoded.createdAt !== "string" || typeof decoded.id !== "number") return null;
    if (!Number.isSafeInteger(decoded.id) || decoded.id <= 0) return null;
    const timestamp = Date.parse(decoded.createdAt);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== decoded.createdAt) return null;
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    return null;
  }
}
