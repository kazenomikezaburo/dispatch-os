import { execFileSync } from "node:child_process";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { prepareAuthFixtures } from "../integration/auth-fixtures.ts";

export type LocalSupabaseConfig = {
  url: string;
  anonKey: string;
  publishableKey: string;
  serviceRoleKey: string;
};

type SupabaseStatus = {
  API_URL?: string;
  ANON_KEY?: string;
  PUBLISHABLE_KEY?: string;
  SERVICE_ROLE_KEY?: string;
};

const isWindows = process.platform === "win32";
const npxCommand = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npx";

function npxArguments(...arguments_: string[]) {
  return isWindows
    ? ["/d", "/s", "/c", ["npx", ...arguments_].join(" ")]
    : arguments_;
}

function isLocalUrl(url: string) {
  return url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost");
}

export function readLocalSupabaseConfig(): LocalSupabaseConfig {
  const output = execFileSync(npxCommand, npxArguments("supabase", "status", "-o", "json"), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const status = JSON.parse(output) as SupabaseStatus;
  const url = status.API_URL ?? "";

  if (!isLocalUrl(url)) {
    throw new Error("Dashboard tests refused a non-local Supabase URL.");
  }
  if (!status.ANON_KEY || !status.PUBLISHABLE_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error("Local Supabase status did not return the required test keys.");
  }

  return {
    url,
    anonKey: status.ANON_KEY,
    publishableKey: status.PUBLISHABLE_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  };
}

export function resetLocalDatabase(config: LocalSupabaseConfig) {
  if (!isLocalUrl(config.url)) throw new Error("Refusing to reset a non-local database.");
  execFileSync(npxCommand, npxArguments("supabase", "db", "reset"), { stdio: "inherit" });
}

export async function installDashboardFixtures(config: LocalSupabaseConfig) {
  if (!isLocalUrl(config.url)) throw new Error("Refusing fixtures on a non-local database.");

  await prepareAuthFixtures({
    url: config.url,
    anonKey: config.anonKey,
    serviceRoleKey: config.serviceRoleKey,
  });

  const { pastStart, pastEnd, futureStart, futureEnd } = relativeTokyoTimes();
  executeLocalSql(`
    insert into public.shift_slots
      (id, job_id, label, starts_at, ends_at, required_workers, status)
    values
      ('8a000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000001',
       'TEST_DASH_PAST', '${pastStart}', '${pastEnd}', 3, 'confirmed'),
      ('8a000000-0000-0000-0000-000000000002',
       '10000000-0000-0000-0000-000000000001',
       'TEST_DASH_FUTURE', '${futureStart}', '${futureEnd}', 1, 'confirmed'),
      ('8a000000-0000-0000-0000-000000000003',
       '10000000-0000-0000-0000-000000000003',
       'TEST_DASH_TOKYO', '${futureStart}', '${futureEnd}', 1, 'confirmed');

    insert into public.assignments
      (id, shift_slot_id, worker_id, status)
    values
      ('8b000000-0000-0000-0000-000000000001',
       '8a000000-0000-0000-0000-000000000001',
       'c0000000-0000-0000-0000-000000000001', 'confirmed'),
      ('8b000000-0000-0000-0000-000000000002',
       '8a000000-0000-0000-0000-000000000001',
       'c0000000-0000-0000-0000-000000000002', 'confirmed'),
      ('8b000000-0000-0000-0000-000000000003',
       '8a000000-0000-0000-0000-000000000002',
       'c0000000-0000-0000-0000-000000000001', 'assigned'),
      ('8b000000-0000-0000-0000-000000000004',
       '8a000000-0000-0000-0000-000000000003',
       'c0000000-0000-0000-0000-000000000003', 'confirmed');

    insert into public.attendance_events
      (id, assignment_id, event_type, source)
    values
      ('8c000000-0000-0000-0000-000000000001',
       '8b000000-0000-0000-0000-000000000004', 'start_work', 'worker');

    insert into public.pre_shift_confirmations
      (id, assignment_id, can_work, health_status)
    values
      ('8d000000-0000-0000-0000-000000000001',
       '8b000000-0000-0000-0000-000000000004', true, 'good');
  `);
}

export function revokeShiftSlotSelect() {
  executeLocalSql("revoke select on table public.shift_slots from authenticated;");
}

export function restoreShiftSlotSelect() {
  executeLocalSql("grant select on table public.shift_slots to authenticated;");
}

function executeLocalSql(sql: string) {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_dispatch-os",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: sql, stdio: ["pipe", "ignore", "pipe"] },
  );
}

function relativeTokyoTimes(now = new Date()) {
  const { start, end } = tokyoDayRange(now);
  const minute = 60_000;
  const pastStart = new Date(Math.max(start.getTime() + minute, now.getTime() - 60 * minute));
  const pastEnd = new Date(Math.min(now.getTime() - minute, pastStart.getTime() + 30 * minute));
  const futureStart = new Date(Math.min(end.getTime() - 31 * minute, now.getTime() + 120 * minute));
  const futureEnd = new Date(Math.min(end.getTime() - minute, futureStart.getTime() + 30 * minute));

  if (!(pastStart < pastEnd && pastEnd < now && now < futureStart && futureStart < futureEnd)) {
    throw new Error("Current time is too close to the Tokyo day boundary for dashboard fixtures.");
  }

  return {
    pastStart: pastStart.toISOString(),
    pastEnd: pastEnd.toISOString(),
    futureStart: futureStart.toISOString(),
    futureEnd: futureEnd.toISOString(),
  };
}

function tokyoDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const start = new Date(Date.UTC(value("year"), value("month") - 1, value("day")) - 9 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
