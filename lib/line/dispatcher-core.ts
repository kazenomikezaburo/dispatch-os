import { z } from "zod";
import type { LinePushConfig } from "@/lib/line/config";
import type { LineDeliveryStore } from "@/lib/line/delivery-db";
import { sendLinePush } from "@/lib/line/push-core";

export type LineDispatcherResult = {
  claimed: number;
  finalized: number;
  stale: number;
  delivered: number;
  retryableFailures: number;
  terminalFailures: number;
  providerAuthFailures: number;
};

export async function runLineDeliveryBatchCore(
  config: LinePushConfig,
  options: {
    limit?: number;
    store: LineDeliveryStore;
    fetcher?: typeof fetch;
    timeoutMs?: number;
    pushEndpoint?: string;
  },
): Promise<LineDispatcherResult> {
  const limit = z.number().int().min(1).max(100).parse(options.limit ?? 20);
  const claims = await options.store.claim(limit);
  let finalized = 0;
  let stale = 0;
  let delivered = 0;
  let retryableFailures = 0;
  let terminalFailures = 0;
  let providerAuthFailures = 0;

  for (const claim of claims) {
    const result = await sendLinePush(config, {
      notificationId: claim.notification_id,
      lineUserId: claim.line_user_id,
      retryKey: claim.retry_key,
      title: claim.notification_title,
      summary: claim.notification_summary,
    }, { fetcher: options.fetcher, timeoutMs: options.timeoutMs, endpoint: options.pushEndpoint });
    const completion = await options.store.finalize(claim, result);
    if (!completion.ok) {
      stale += 1;
      continue;
    }
    finalized += 1;
    if (completion.status === "delivered") delivered += 1;
    else if (completion.status === "retryable_failure") retryableFailures += 1;
    else if (completion.status === "terminal_failure") terminalFailures += 1;
    if (completion.reason === "provider_auth" || completion.reason === "provider_forbidden") {
      providerAuthFailures += 1;
    }
  }

  return { claimed: claims.length, finalized, stale, delivered, retryableFailures, terminalFailures, providerAuthFailures };
}
