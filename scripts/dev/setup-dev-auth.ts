import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { prepareAuthFixtures } from "../integration/auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { ACTORS, TEST_PASSWORD } from "../integration/test-data.ts";

type LocalSupabaseStatus = {
  API_URL?: string;
  ANON_KEY?: string;
  SERVICE_ROLE_KEY?: string;
};

const isWindows = process.platform === "win32";
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npx";
const arguments_ = isWindows
  ? ["/d", "/s", "/c", "npx supabase status -o json"]
  : ["supabase", "status", "-o", "json"];

const accounts = [
  { label: "Manager", actor: ACTORS.managerA },
  { label: "Worker", actor: ACTORS.workerA },
  { label: "System Admin", actor: ACTORS.systemAdmin },
] as const;

try {
  const status = readLocalStatus();
  const url = status.API_URL ?? "";

  if (!isLocalUrl(url)) {
    throw new Error("DEV Auth setup refused a non-local Supabase URL.");
  }
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error("Local Supabase did not return the required Auth fixture keys.");
  }

  await prepareAuthFixtures({
    url,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  });

  for (const account of accounts) {
    const supabase = createClient(url, status.ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.actor.email,
      password: TEST_PASSWORD,
    });
    const verified = !error && data.user?.id === account.actor.id && Boolean(data.session);

    if (!verified) {
      throw new Error(`${account.label} local login verification failed.`);
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error(`${account.label} local session cleanup failed.`);
    }
    console.log(`${account.label} PASS`);
  }

  console.log(`
DEV AUTH READY

Manager:
${ACTORS.managerA.email}
${TEST_PASSWORD}

Worker:
${ACTORS.workerA.email}
${TEST_PASSWORD}

System Admin:
${ACTORS.systemAdmin.email}
${TEST_PASSWORD}`);
} catch (error: unknown) {
  console.error(
    "DEV Auth setup failed:",
    error instanceof Error ? error.message : "Unknown local setup error",
  );
  process.exitCode = 1;
}

function readLocalStatus() {
  const output = execFileSync(command, arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(output) as LocalSupabaseStatus;
}

function isLocalUrl(url: string) {
  return url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost");
}
