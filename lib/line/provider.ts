import "server-only";

import { z } from "zod";
import type { LineServerConfig } from "@/lib/line/config";
import { lineCallbackUri } from "@/lib/line/config";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
});
const verifiedIdTokenSchema = z.object({
  iss: z.literal("https://access.line.me"),
  sub: z.string().regex(/^U[0-9a-f]{32}$/),
  aud: z.string(),
  exp: z.number().int(),
  nonce: z.string(),
});
const friendshipSchema = z.object({ friendFlag: z.boolean() });

type LineProviderStage = "token_exchange" | "id_token_verification" | "friendship_status";

export class LineProviderDiagnosticError extends Error {
  constructor(
    readonly stage: LineProviderStage,
    readonly upstreamStatus?: number,
    readonly providerErrorCode?: string,
    readonly requestId?: string,
  ) {
    super(`LINE provider request failed at ${stage}`);
    this.name = "LineProviderDiagnosticError";
  }
}

function safeDiagnosticValue(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength && /^[A-Za-z0-9_.-]+$/.test(value)
    ? value
    : undefined;
}

async function providerFetch(
  stage: LineProviderStage,
  fetcher: typeof fetch,
  input: string,
  init: RequestInit,
) {
  try {
    return await fetcher(input, init);
  } catch {
    throw new LineProviderDiagnosticError(stage);
  }
}

async function providerJson<T>(response: Response, schema: z.ZodType<T>, stage: LineProviderStage) {
  const requestId = safeDiagnosticValue(response.headers.get("x-line-request-id"), 128);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LineProviderDiagnosticError(stage, response.status, undefined, requestId);
  }
  if (!response.ok) {
    const errorCode = payload && typeof payload === "object" && !Array.isArray(payload)
      ? safeDiagnosticValue((payload as Record<string, unknown>).error, 64)
      : undefined;
    throw new LineProviderDiagnosticError(stage, response.status, errorCode, requestId);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new LineProviderDiagnosticError(stage, response.status, undefined, requestId);
  return parsed.data;
}

export function buildLineAuthorizationUrl(config: LineServerConfig, state: string, nonce: string) {
  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.loginChannelId,
    redirect_uri: lineCallbackUri(config),
    state,
    nonce,
    scope: "openid profile",
    bot_prompt: "aggressive",
  }).toString();
  return url.toString();
}

export async function completeLineAuthorization(
  config: LineServerConfig,
  code: string,
  expectedNonce: string,
  fetcher: typeof fetch = fetch,
) {
  const tokenResponse = await providerFetch("token_exchange", fetcher, "https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: lineCallbackUri(config),
      client_id: config.loginChannelId,
      client_secret: config.loginChannelSecret,
    }),
    cache: "no-store",
  });
  const tokens = await providerJson(tokenResponse, tokenResponseSchema, "token_exchange");

  const verifyResponse = await providerFetch("id_token_verification", fetcher, "https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: tokens.id_token, client_id: config.loginChannelId }),
    cache: "no-store",
  });
  const identity = await providerJson(verifyResponse, verifiedIdTokenSchema, "id_token_verification");
  if (identity.aud !== config.loginChannelId || identity.nonce !== expectedNonce || identity.exp * 1000 <= Date.now()) {
    throw new LineProviderDiagnosticError("id_token_verification", verifyResponse.status, undefined, safeDiagnosticValue(verifyResponse.headers.get("x-line-request-id"), 128));
  }

  const friendshipResponse = await providerFetch("friendship_status", fetcher, "https://api.line.me/friendship/v1/status", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  const friendship = await providerJson(friendshipResponse, friendshipSchema, "friendship_status");
  return { lineUserId: identity.sub, friendAvailable: friendship.friendFlag };
}
