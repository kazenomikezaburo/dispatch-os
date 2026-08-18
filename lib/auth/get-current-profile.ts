import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AccountType, CurrentProfile, CurrentProfileResult } from "@/lib/auth/types";

const ACCOUNT_TYPES: readonly AccountType[] = ["worker", "manager", "system_admin"];

function isAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPES.includes(value as AccountType);
}

export async function getCurrentProfile(): Promise<CurrentProfileResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return { status: "unauthenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, account_type, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !isAccountType(data.account_type)) return { status: "misconfigured" };

  const profile: CurrentProfile = {
    id: data.id,
    display_name: data.display_name,
    account_type: data.account_type,
    is_active: data.is_active,
  };

  if (!profile.is_active) return { status: "inactive", profile };

  if (profile.account_type === "worker") {
    const { count, error: workerError } = await supabase
      .from("workers")
      .select("id", { count: "exact", head: true })
      .eq("auth_profile_id", profile.id)
      .eq("status", "active");
    if (workerError || count !== 1) return { status: "misconfigured" };
  }

  if (profile.account_type === "manager") {
    const { count, error: accessError } = await supabase
      .from("manager_branch_access")
      .select("branch_id", { count: "exact", head: true })
      .eq("profile_id", profile.id);
    if (accessError || !count) return { status: "misconfigured" };
  }

  return { status: "authenticated", profile };
}
