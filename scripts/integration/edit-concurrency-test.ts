import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

type TestResult = { id: string; passed: boolean; actual: string };

const results: TestResult[] = [];
const containerName = "supabase_db_dispatch-os";

function record(id: string, passed: boolean, actual: string) {
  results.push({ id, passed, actual });
  console.log(`${passed ? "PASS" : "FAIL"} ${id}: ${actual}`);
}

function getLocalApiUrl(): string {
  const output =
    process.platform === "win32"
      ? execFileSync(
          "powershell.exe",
          ["-NoProfile", "-Command", "npx supabase status -o json"],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        )
      : execFileSync("npx", ["supabase", "status", "-o", "json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
  const jsonStart = output.indexOf("{");
  if (jsonStart < 0) throw new Error("Local Supabase status is unavailable.");

  const status = JSON.parse(output.slice(jsonStart)) as { API_URL?: string };
  if (!status.API_URL) throw new Error("Local Supabase API URL is unavailable.");

  const hostname = new URL(status.API_URL).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error("Refusing to run outside local Supabase.");
  }
  return status.API_URL;
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-q",
    ],
    { input: sql, encoding: "utf8" },
  ).trim();
}

function psqlAsync(sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      containerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-q",
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `psql exited with ${code}`));
    });
    child.stdin.end(sql);
  });
}

function conditionalUpdate(projectId: string, expectedUpdatedAt: string, marker: string) {
  return `
    update public.projects
       set description = '${marker}'
     where id = '${projectId}'::uuid
       and updated_at = '${expectedUpdatedAt}'::timestamptz
    returning updated_at::text;
  `;
}

async function main() {
  const apiUrl = getLocalApiUrl();
  console.log(`Local Supabase confirmed: ${apiUrl}`);

  const projectId = randomUUID();
  let inserted = false;

  try {
    const initialUpdatedAt = psql(`
      insert into public.projects (
        id, branch_id, name, start_date, end_date, description
      )
      select
        '${projectId}'::uuid,
        id,
        'EDIT CONCURRENCY TEST',
        current_date,
        current_date,
        'initial'
      from public.branches
      order by id
      limit 1
      returning updated_at::text;
    `);
    inserted = true;

    record(
      "TEST-EDIT-CONCURRENCY-001",
      Boolean(psql(conditionalUpdate(projectId, initialUpdatedAt, "fresh"))),
      "latest updated_at matched one row",
    );

    const afterFresh = psql(
      `select updated_at::text from public.projects where id = '${projectId}'::uuid;`,
    );
    record(
      "TEST-EDIT-CONCURRENCY-004",
      afterFresh !== initialUpdatedAt,
      `trigger changed token=${afterFresh !== initialUpdatedAt}`,
    );

    const stale = psql(conditionalUpdate(projectId, initialUpdatedAt, "stale"));
    record(
      "TEST-EDIT-CONCURRENCY-002",
      stale === "",
      `stale update rows=${stale === "" ? 0 : 1}`,
    );

    const concurrentToken = afterFresh;
    const concurrent = await Promise.all([
      psqlAsync(conditionalUpdate(projectId, concurrentToken, "concurrent-1")),
      psqlAsync(conditionalUpdate(projectId, concurrentToken, "concurrent-2")),
    ]);
    const successes = concurrent.filter(Boolean).length;
    record(
      "TEST-EDIT-CONCURRENCY-003",
      successes === 1,
      `success=${successes}, conflict=${2 - successes}`,
    );

  } finally {
    if (inserted) {
      psql(`delete from public.projects where id = '${projectId}'::uuid;`);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  console.log(`Total ${results.length} / Passed ${passed} / Failed ${results.length - passed}`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Concurrency test failed.");
  process.exitCode = 1;
});
