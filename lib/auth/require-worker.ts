import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import type { CurrentProfile } from "@/lib/auth/types";

export async function requireWorker(): Promise<CurrentProfile> {
  const profile = await requireAuth();
  if (profile.account_type !== "worker") redirect("/admin");
  return profile;
}
