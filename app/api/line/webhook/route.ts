import { NextResponse } from "next/server";
import { z } from "zod";
import { getLineServerConfig } from "@/lib/line/config";
import { hmacSha256Base64, safeEqual } from "@/lib/line/crypto";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 256 * 1024;

const sourceSchema = z.object({ type: z.literal("user"), userId: z.string().regex(/^U[0-9a-f]{32}$/) });
const eventSchema = z.object({
  type: z.string(),
  timestamp: z.number().int().nonnegative(),
  webhookEventId: z.string().min(1).max(128),
  source: z.unknown().optional(),
});
const webhookSchema = z.object({ events: z.array(eventSchema).max(100) });

export async function POST(request: Request) {
  const config = getLineServerConfig();
  if (!config) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const signature = request.headers.get("x-line-signature") ?? "";
  if (!safeEqual(signature, hmacSha256Base64(rawBody, config.messagingChannelSecret))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let parsed: z.infer<typeof webhookSchema>;
  try {
    parsed = webhookSchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (parsed.events.length === 0) return new NextResponse(null, { status: 200 });

  const supabase = await createClient();
  for (const event of parsed.events) {
    if (event.type !== "follow" && event.type !== "unfollow") continue;
    const source = sourceSchema.safeParse(event.source);
    if (!source.success) continue;
    const result = await supabase.rpc("apply_line_friendship_webhook", {
      p_webhook_event_id: event.webhookEventId,
      p_event_type: event.type,
      p_line_user_id: source.data.userId,
      p_event_timestamp: new Date(event.timestamp).toISOString(),
      p_internal_secret: config.internalCommandSecret,
    });
    const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data as Record<string, unknown>
      : null;
    if (result.error || data?.ok !== true) return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
