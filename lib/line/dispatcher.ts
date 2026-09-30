import "server-only";

import { requireLinePushConfig } from "@/lib/line/config";
import { createLineDeliveryStore, type LineDeliveryMode, type LineDeliveryStore } from "@/lib/line/delivery-db";
import { runLineDeliveryBatchCore, type LineDispatcherResult } from "@/lib/line/dispatcher-core";

export type { LineDispatcherResult } from "@/lib/line/dispatcher-core";

export async function runLineDeliveryBatch(options: {
  limit?: number;
  store?: LineDeliveryStore;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  pushEndpoint?: string;
  mode?: LineDeliveryMode;
} = {}): Promise<LineDispatcherResult> {
  const store = options.store ?? createLineDeliveryStore(options.mode);
  const config = requireLinePushConfig();
  return runLineDeliveryBatchCore(config, { ...options, store });
}
