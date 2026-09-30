import { z } from "zod";
import type { LinePushConfig } from "@/lib/line/config";

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const DEFAULT_TIMEOUT_MS = 10_000;
const uuidSchema = z.string().uuid();
const lineUserIdSchema = z.string().regex(/^U[0-9a-f]{32}$/);
const controlledTextSchema = z.string().min(1);

export type LinePushInput = {
  notificationId: string;
  lineUserId: string;
  retryKey: string;
  title: string;
  summary: string;
};

export type LinePushResult = {
  resultKind: "http" | "timeout" | "network";
  httpStatus: number | null;
  retryAfterSeconds: number | null;
  retryKeyAccepted: boolean;
  safeErrorCode: "invalid_destination" | null;
  providerRequestId: string | null;
};

function safeRequestId(value: string | null) {
  return value && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value) ? value : null;
}

function retryAfterSeconds(value: string | null, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isInteger(seconds) && seconds >= 0) return Math.min(seconds, 82_800);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, Math.ceil((date - now) / 1000)), 82_800);
}

export function buildLineNotificationEntryUrl(appOrigin: string, notificationId: string) {
  const origin = new URL(appOrigin);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("LINE push origin must be an HTTPS origin");
  }
  const id = uuidSchema.parse(notificationId);
  return new URL(`/worker/notifications/${id}`, origin).toString();
}

export function buildLinePushText(config: LinePushConfig, input: LinePushInput) {
  const title = controlledTextSchema.max(120).parse(input.title);
  const summary = controlledTextSchema.max(240).parse(input.summary);
  return `${title}\n${summary}\n${buildLineNotificationEntryUrl(config.appOrigin, input.notificationId)}`;
}

export async function sendLinePush(
  config: LinePushConfig,
  input: LinePushInput,
  options: { fetcher?: typeof fetch; timeoutMs?: number; endpoint?: string } = {},
): Promise<LinePushResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = z.number().int().min(100).max(30_000).parse(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const retryKey = uuidSchema.parse(input.retryKey);
  const to = lineUserIdSchema.parse(input.lineUserId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(options.endpoint ?? LINE_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.channelAccessToken}`,
        "content-type": "application/json",
        "x-line-retry-key": retryKey,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text: buildLinePushText(config, input) }],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const requestId = safeRequestId(response.headers.get("x-line-request-id"));
    const acceptedRequestId = safeRequestId(response.headers.get("x-line-accepted-request-id"));
    const confirmedAccepted = response.status === 409 && acceptedRequestId !== null;
    return {
      resultKind: "http",
      httpStatus: response.status,
      retryAfterSeconds: response.status === 429 ? retryAfterSeconds(response.headers.get("retry-after")) : null,
      retryKeyAccepted: confirmedAccepted,
      safeErrorCode: null,
      providerRequestId: confirmedAccepted ? acceptedRequestId : requestId,
    };
  } catch (error) {
    return {
      resultKind: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network",
      httpStatus: null,
      retryAfterSeconds: null,
      retryKeyAccepted: false,
      safeErrorCode: null,
      providerRequestId: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
