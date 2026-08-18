import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
// @ts-ignore Node's native TypeScript loader requires the explicit .ts suffix.
import { ACTORS, TEST_PASSWORD } from "./test-data.ts";

export type ActorName = "anon" | keyof typeof ACTORS;
export type ActorClients = Record<ActorName, SupabaseClient>;

type LocalConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function readLocalConfig(): LocalConfig {
  const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url.startsWith("http://127.0.0.1:") && !url.startsWith("http://localhost:")) {
    throw new Error(`Refusing non-local Supabase URL: ${url}`);
  }
  if (!anonKey || !serviceRoleKey) {
    throw new Error("SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return { url, anonKey, serviceRoleKey };
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function prepareAuthFixtures(config: LocalConfig): Promise<void> {
  const ids = Object.values(ACTORS).map((actor) => `'${actor.id}'`).join(",");
  const normalizeSql = `
    update auth.users
    set confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        reauthentication_token = coalesce(reauthentication_token, '')
    where id in (${ids});
  `;
  execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql",
    "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
    input: normalizeSql,
    stdio: ["pipe", "ignore", "pipe"],
  });

  const admin = client(config.url, config.serviceRoleKey);
  for (const fixture of Object.values(ACTORS)) {
    const { error } = await admin.auth.admin.updateUserById(fixture.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Auth fixture failed for ${fixture.email}: ${error.message}`);
  }
}

export async function createActorClients(config: LocalConfig): Promise<ActorClients> {
  const clients = { anon: client(config.url, config.anonKey) } as ActorClients;
  for (const [name, fixture] of Object.entries(ACTORS)) {
    const actorClient = client(config.url, config.anonKey);
    const { data, error } = await actorClient.auth.signInWithPassword({
      email: fixture.email,
      password: TEST_PASSWORD,
    });
    if (error || !data.session) {
      throw new Error(`Authentication failed for ${fixture.email}: ${error?.message ?? "no session"}`);
    }
    clients[name as keyof typeof ACTORS] = actorClient;
  }
  return clients;
}
