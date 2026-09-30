import "server-only";

import { cookies } from "next/headers";
import { getContinuationSecret } from "@/lib/line/config";
import { NOTIFICATION_CONTINUATION_COOKIE } from "@/lib/line/constants";
import { sha256 } from "@/lib/line/crypto";
import { readNotificationContinuation } from "@/lib/line/signed-cookie";
import { createClient } from "@/lib/supabase/server";

export async function consumeOwnNotificationContinuation() {
  const secret = getContinuationSecret();
  const cookieStore = await cookies();
  const raw = cookieStore.get(NOTIFICATION_CONTINUATION_COOKIE)?.value;
  cookieStore.delete(NOTIFICATION_CONTINUATION_COOKIE);
  if (!secret) return null;
  const continuation = readNotificationContinuation(raw, secret);
  if (!continuation) return null;
  const supabase = await createClient();
  const result = await supabase.rpc("consume_own_notification_continuation", {
    p_notification_id: continuation.notificationId,
    p_nonce_hash: sha256(continuation.nonce),
    p_expires_at: new Date(continuation.expiresAt).toISOString(),
  });
  const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : null;
  return !result.error && data?.ok === true
    ? `/worker/notifications/${continuation.notificationId}`
    : null;
}
