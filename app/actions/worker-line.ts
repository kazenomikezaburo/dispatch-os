"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireWorker } from "@/lib/auth/require-worker";
import { getLineServerConfig } from "@/lib/line/config";
import { LINE_LINK_COOKIE, TEN_MINUTES_SECONDS } from "@/lib/line/constants";
import { randomOpaque, sha256 } from "@/lib/line/crypto";
import { buildLineAuthorizationUrl } from "@/lib/line/provider";
import { createLineLinkCookie } from "@/lib/line/signed-cookie";
import { createClient } from "@/lib/supabase/server";

function isOk(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).ok === true;
}

export async function startOwnLineLink(): Promise<never> {
  await requireWorker();
  const config = getLineServerConfig();
  if (!config) redirect("/worker/settings/line?result=configuration_unavailable");

  const state = randomOpaque();
  const nonce = randomOpaque();
  const expiresAt = Date.now() + TEN_MINUTES_SECONDS * 1000;
  const supabase = await createClient();
  const result = await supabase.rpc("begin_own_line_link", {
    p_state_hash: sha256(state),
    p_nonce_hash: sha256(nonce),
  });
  if (result.error || !isOk(result.data)) redirect("/worker/settings/line?result=link_start_failed");

  const cookieStore = await cookies();
  cookieStore.set(LINE_LINK_COOKIE, createLineLinkCookie({ state, nonce, expiresAt }, config.continuationSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/line/callback",
    maxAge: TEN_MINUTES_SECONDS,
  });
  redirect(buildLineAuthorizationUrl(config, state, nonce));
}

export async function setOwnLineReminders(formData: FormData): Promise<never> {
  await requireWorker();
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();
  const result = await supabase.rpc("set_own_line_reminders_enabled", { p_enabled: enabled });
  redirect(result.error || !isOk(result.data)
    ? "/worker/settings/line?result=consent_failed"
    : `/worker/settings/line?result=${enabled ? "enabled" : "disabled"}`);
}

export async function unlinkOwnLineAccount(): Promise<never> {
  await requireWorker();
  const supabase = await createClient();
  const result = await supabase.rpc("unlink_own_line_account");
  redirect(result.error || !isOk(result.data)
    ? "/worker/settings/line?result=unlink_failed"
    : "/worker/settings/line?result=unlinked");
}
