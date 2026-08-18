"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData): Promise<never> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") redirect("/login?error=invalid_credentials");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) redirect("/login?error=invalid_credentials");

  const result = await getCurrentProfile();
  if (result.status === "inactive") redirect("/auth/error?reason=inactive");
  if (result.status !== "authenticated") redirect("/auth/error");
  redirect(result.profile.account_type === "worker" ? "/worker" : "/admin");
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
