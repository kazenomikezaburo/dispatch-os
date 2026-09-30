import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
let passed = 0;
function pass(name, condition) { assert.ok(condition, name); passed += 1; console.log(`PASS ${name}`); }

const webhook = read("app/api/line/webhook/route.ts");
const callback = read("app/api/line/callback/route.ts");
const provider = read("lib/line/provider.ts");
const proxy = read("proxy.ts");
const config = read("lib/line/config.ts");
const migration = read("supabase/migrations/20260928125430_ocv1_line_identity_consent_safe_entry.sql");

pass("webhook reads untouched text before JSON parsing", webhook.indexOf("request.text()") < webhook.indexOf("JSON.parse(rawBody)"));
pass("webhook verifies x-line-signature with Messaging channel secret", webhook.includes('headers.get("x-line-signature")') && webhook.includes("hmacSha256Base64(rawBody, config.messagingChannelSecret)"));
pass(
  "invalid signature returns 401 before any RPC",
  webhook.includes('{ error: "invalid_signature" }, { status: 401 }')
    && webhook.indexOf("invalid_signature") < webhook.indexOf('supabase.rpc("apply_line_friendship_webhook"'),
);
pass("empty verification and processed event requests return 200", webhook.includes("parsed.events.length === 0") && webhook.match(/new NextResponse\(null, \{ status: 200 \}\)/g)?.length === 2);
pass("only follow and unfollow reach mutation command", webhook.includes('event.type !== "follow" && event.type !== "unfollow"'));
pass("provider authorization requests frozen scope and aggressive bot prompt", provider.includes('scope: "openid profile"') && provider.includes('bot_prompt: "aggressive"'));
pass("provider callback verifies ID token through LINE verify endpoint", provider.includes("oauth2/v2.1/verify") && provider.includes("identity.aud !== config.loginChannelId") && provider.includes("identity.nonce !== expectedNonce") && provider.includes("identity.exp * 1000 <= Date.now()"));
pass("provider friendship status is server-read", provider.includes("friendship/v1/status") && provider.includes("Bearer ${tokens.access_token}"));
pass("provider tokens are not returned from the adapter", provider.includes("return { lineUserId: identity.sub, friendAvailable: friendship.friendFlag }") && !provider.includes("return { access"));
pass("callback requires authenticated Worker before provider exchange", callback.indexOf("const profile = await getCurrentProfile()") < callback.indexOf("identity = await completeLineAuthorization"));
pass("callback compares signed-cookie state before provider exchange", callback.indexOf("safeEqual(params.data.state, linkCookie.state)") < callback.indexOf("identity = await completeLineAuthorization"));
pass("provider diagnostics are stage-bound and redact provider payloads", provider.includes('"token_exchange"') && provider.includes('"id_token_verification"') && provider.includes('"friendship_status"') && callback.includes('stage: "link_finalize"') && !callback.includes("console.error(error") && !provider.includes("error_description"));
pass("deep-link continuation allowlist is exact UUID path", proxy.includes("const notificationPath = /^\\/worker\\/notifications\\/") && !proxy.includes("returnTo"));
pass("continuation is HttpOnly, same-site and ten minutes", proxy.includes("httpOnly: true") && proxy.includes('sameSite: "lax"') && proxy.includes("maxAge: TEN_MINUTES_SECONDS"));
pass("no LINE secret uses NEXT_PUBLIC prefix", !config.includes("NEXT_PUBLIC_LINE") && !callback.includes("NEXT_PUBLIC_LINE") && !webhook.includes("NEXT_PUBLIC_LINE"));
pass("private persistence contains no provider token columns", !/\b(access_token|refresh_token|id_token)\b/.test(migration));
pass("C1 contains no push delivery implementation", !/api\.line\.me\/v2\/bot\/message\/push|X-Line-Retry-Key/.test([webhook, callback, provider].join("\n")));

let clientSecretMatches = "";
try {
  clientSecretMatches = execFileSync("git", ["grep", "-n", "-E", "LINE_LOGIN_CHANNEL_SECRET|LINE_MESSAGING_CHANNEL_SECRET|OPSCUE_LINE_INTERNAL_SECRET|OPSCUE_CONTINUATION_SECRET", "--", "app", "components"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch (error) {
  if (error.status !== 1) throw error;
}
pass("no LINE secret value is embedded in a client component", !clientSecretMatches.split(/\r?\n/).some((line) => line.includes('"use client"')));
console.log(`Worker LINE boundary source: PASS (${passed} assertions)`);
