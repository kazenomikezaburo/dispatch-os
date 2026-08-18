import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import type { CurrentProfile } from "@/lib/auth/types";

export async function requireAuth(): Promise<CurrentProfile> {
  const result = await getCurrentProfile();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "inactive") redirect("/auth/error?reason=inactive");
  if (result.status === "misconfigured") redirect("/auth/error");
  return result.profile;
}
