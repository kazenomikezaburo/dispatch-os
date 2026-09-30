import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { requireLineServerConfig } from "@/lib/line/config";
import { LINE_LINK_COOKIE } from "@/lib/line/constants";
import { safeEqual, sha256 } from "@/lib/line/crypto";
import { completeLineAuthorization, LineProviderDiagnosticError } from "@/lib/line/provider";
import { readLineLinkCookie } from "@/lib/line/signed-cookie";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(32).max(256),
});

function resultRedirect(origin: string, result: string) {
  return NextResponse.redirect(new URL(`/worker/settings/line?result=${result}`, origin), 303);
}

export async function GET(request: Request) {
  let config: ReturnType<typeof requireLineServerConfig>;
  try {
    config = requireLineServerConfig();
  } catch {
    return NextResponse.redirect(new URL("/worker/settings/line?result=configuration_unavailable", request.url), 303);
  }
  const cookieStore = await cookies();
  const clearCookie = () => cookieStore.delete(LINE_LINK_COOKIE);
  const params = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const linkCookie = readLineLinkCookie(cookieStore.get(LINE_LINK_COOKIE)?.value, config.continuationSecret);
  const profile = await getCurrentProfile();
  if (profile.status !== "authenticated" || profile.profile.account_type !== "worker") {
    clearCookie();
    return NextResponse.redirect(new URL("/login?reason=line_session_required", config.appOrigin), 303);
  }
  if (!params.success || !linkCookie || !safeEqual(params.data.state, linkCookie.state)) {
    clearCookie();
    return resultRedirect(config.appOrigin, "link_invalid");
  }

  let identity: Awaited<ReturnType<typeof completeLineAuthorization>>;
  try {
    identity = await completeLineAuthorization(config, params.data.code, linkCookie.nonce);
  } catch (error) {
    console.error("LINE link provider failure", error instanceof LineProviderDiagnosticError
      ? {
          stage: error.stage,
          upstreamStatus: error.upstreamStatus,
          providerErrorCode: error.providerErrorCode,
          requestId: error.requestId,
        }
      : { stage: "provider_unknown" });
    clearCookie();
    return resultRedirect(config.appOrigin, "provider_failed");
  }

  try {
    const supabase = await createClient();
    const result = await supabase.rpc("complete_own_line_link", {
      p_state_hash: sha256(linkCookie.state),
      p_nonce_hash: sha256(linkCookie.nonce),
      p_line_user_id: identity.lineUserId,
      p_friend_available: identity.friendAvailable,
      p_internal_secret: config.internalCommandSecret,
    });
    const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data as Record<string, unknown>
      : null;
    clearCookie();
    if (result.error || data?.ok !== true) {
      return resultRedirect(config.appOrigin, data?.code === "LINK_CONFLICT" ? "link_conflict" : "link_invalid");
    }
    return resultRedirect(config.appOrigin, identity.friendAvailable ? "linked" : "linked_unavailable");
  } catch {
    console.error("LINE link provider failure", { stage: "link_finalize" });
    clearCookie();
    return resultRedirect(config.appOrigin, "provider_failed");
  }
}
