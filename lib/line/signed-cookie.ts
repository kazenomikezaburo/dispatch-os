import "server-only";

import { z } from "zod";
import { hmacSha256, safeEqual } from "@/lib/line/crypto";

const linkCookieSchema = z.object({ state: z.string().min(32), nonce: z.string().min(32), expiresAt: z.number().int() });
const continuationSchema = z.object({ notificationId: z.string().uuid(), nonce: z.string().min(32), expiresAt: z.number().int() });

function signPayload(payload: object, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${hmacSha256(encoded, secret)}`;
}

function readPayload<T>(value: string | undefined, secret: string, schema: z.ZodType<T>): T | null {
  if (!value) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra || !safeEqual(signature, hmacSha256(encoded, secret))) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    if (!parsed.success || (parsed.data as { expiresAt: number }).expiresAt <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function createLineLinkCookie(payload: z.infer<typeof linkCookieSchema>, secret: string) {
  return signPayload(payload, secret);
}
export function readLineLinkCookie(value: string | undefined, secret: string) {
  return readPayload(value, secret, linkCookieSchema);
}
export function createNotificationContinuation(payload: z.infer<typeof continuationSchema>, secret: string) {
  return signPayload(payload, secret);
}
export function readNotificationContinuation(value: string | undefined, secret: string) {
  return readPayload(value, secret, continuationSchema);
}
