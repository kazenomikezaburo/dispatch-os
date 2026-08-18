import { execFileSync, spawn, type ChildProcess } from "node:child_process";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { installDashboardFixtures, readLocalSupabaseConfig, resetLocalDatabase, restoreShiftSlotSelect, revokeShiftSlotSelect, type LocalSupabaseConfig } from "./fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { result, ruleTestCases, type DashboardTestResult } from "./test-cases.ts";

const appOrigin = "http://127.0.0.1:3101";
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
let appProcess: ChildProcess | undefined;
let config: LocalSupabaseConfig | undefined;
let selectWasRevoked = false;
const results: DashboardTestResult[] = [];

async function main() {
 try {
  config = readLocalSupabaseConfig();
  console.log("Local Supabase guard: PASS");
  resetLocalDatabase(config);
  await installDashboardFixtures(config);

  results.push(...ruleTestCases());

  buildApplication(config);
  appProcess = startApplication(config);
  await waitForApplication();

  const manager = new HttpBrowser();
  await manager.login("manager-a@test.invalid");
  const managerDashboard = await manager.get("/admin");
  const managerHtml = await managerDashboard.text();
  const managerCards = summaryCardValues(managerHtml);
  results.push(
    result(
      "DASH-009",
      "Manager branch RLS",
      "Nagoya visible, Tokyo hidden, active=2",
      `status=${managerDashboard.status} active=${managerCards[0] ?? "?"} nagoya=${managerHtml.includes("TEST Nagoya Workplace")} tokyo=${managerHtml.includes("TEST Tokyo Workplace")}`,
      managerDashboard.status === 200 &&
        managerCards[0] === 2 &&
        managerHtml.includes("TEST Nagoya Workplace") &&
        !managerHtml.includes("TEST Tokyo Workplace"),
      "RLS",
    ),
  );

  const systemAdmin = new HttpBrowser();
  await systemAdmin.login("system-admin@test.invalid");
  const adminDashboard = await systemAdmin.get("/admin");
  const adminHtml = await adminDashboard.text();
  const adminCards = summaryCardValues(adminHtml);
  results.push(
    result(
      "DASH-010",
      "System Admin RLS",
      "Nagoya and Tokyo visible, active=3",
      `status=${adminDashboard.status} active=${adminCards[0] ?? "?"} nagoya=${adminHtml.includes("TEST Nagoya Workplace")} tokyo=${adminHtml.includes("TEST Tokyo Workplace")}`,
      adminDashboard.status === 200 &&
        adminCards[0] === 3 &&
        adminHtml.includes("TEST Nagoya Workplace") &&
        adminHtml.includes("TEST Tokyo Workplace"),
      "RLS",
    ),
  );

  revokeShiftSlotSelect();
  selectWasRevoked = true;
  let errorDashboard: Response;
  try {
    errorDashboard = await manager.get("/admin");
  } finally {
    restoreShiftSlotSelect();
    selectWasRevoked = false;
  }
  const errorHtml = await errorDashboard.text();
  const genericError = errorHtml.includes("ダッシュボードを取得できませんでした") &&
    errorHtml.includes("時間をおいて再度お試しください");
  const internalErrorHidden = !errorHtml.includes("permission denied") &&
    !errorHtml.includes("42501") &&
    !errorHtml.includes("shift_slots");
  results.push(
    result(
      "DASH-012",
      "Dashboard query failure UI",
      "Generic message without internal database error",
      `status=${errorDashboard.status} generic=${genericError} internalHidden=${internalErrorHidden}`,
      errorDashboard.status === 200 && genericError && internalErrorHidden,
      "Error Handling",
    ),
  );
 } catch (error: unknown) {
  console.error("Dashboard test runner failed:", safeErrorMessage(error));
 } finally {
  if (selectWasRevoked) {
    try {
      restoreShiftSlotSelect();
    } catch {
      // The final local reset below is the authoritative cleanup.
    }
  }
  if (appProcess) stopApplication(appProcess);
  if (config) {
    try {
      resetLocalDatabase(config);
    } catch (error: unknown) {
      console.error("Final local database reset failed:", safeErrorMessage(error));
    }
  }
 }

 printResults(results);
 const allPassed = results.length === 12 && results.every((test) => test.passed);
 if (!allPassed) process.exitCode = 1;
}

function buildApplication(localConfig: LocalSupabaseConfig) {
  execFileSync(npmCommand, npmArguments("run", "build"), {
    env: applicationEnvironment(localConfig),
    stdio: "inherit",
  });
}

function startApplication(localConfig: LocalSupabaseConfig) {
  const child = spawn(
    npmCommand,
    npmArguments("run", "start", "--", "--hostname", "127.0.0.1", "--port", "3101"),
    {
      env: applicationEnvironment(localConfig),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdout?.resume();
  child.stderr?.resume();
  return child;
}

function npmArguments(...arguments_: string[]) {
  return isWindows
    ? ["/d", "/s", "/c", ["npm", ...arguments_].join(" ")]
    : arguments_;
}

function applicationEnvironment(localConfig: LocalSupabaseConfig) {
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: localConfig.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localConfig.publishableKey,
  };
}

async function waitForApplication() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${appOrigin}/login`, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // The local Next.js process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local Next.js server did not become ready within 30 seconds.");
}

function stopApplication(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } catch {
      // It may already have exited.
    }
  } else {
    child.kill("SIGTERM");
  }
}

class HttpBrowser {
  private readonly cookies = new Map<string, string>();

  async login(email: string) {
    const loginPage = await this.get("/login");
    const html = await loginPage.text();
    const actionId = html.match(/name="(\$ACTION_ID_[a-f0-9]+)"/)?.[1];
    if (!actionId) throw new Error("Login Server Action was not found.");

    const form = new FormData();
    form.append(actionId, "");
    form.append("email", email);
    form.append("password", "TestPassword123!");
    const response = await this.request("/login", { method: "POST", body: form });
    if (response.status !== 303) {
      throw new Error(`Local test login failed with HTTP ${response.status}.`);
    }
  }

  get(path: string) {
    return this.request(path);
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }
    if (init.method === "POST") headers.set("origin", appOrigin);

    const response = await fetch(`${appOrigin}${path}`, {
      ...init,
      headers,
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (!value || /Max-Age=0/i.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }
}

function summaryCardValues(html: string) {
  return [...html.matchAll(/<p class="mt-3 text-3xl[^>]*>(\d+)<span/g)].map(
    (match) => Number(match[1]),
  );
}

function printResults(testResults: DashboardTestResult[]) {
  for (const test of testResults.sort((left, right) => left.id.localeCompare(right.id))) {
    console.log(`\n${test.id}\n${test.description}\n\nExpected:\n${test.expected}\n\nActual:\n${test.actual}\n\n${test.passed ? "PASS" : "FAIL"}`);
  }

  const categories: DashboardTestResult["category"][] = [
    "Data Rules",
    "Alert Rules",
    "Aggregation",
    "RLS",
    "Empty State",
    "Error Handling",
  ];
  console.log("\nDASHBOARD TEST RESULT\n");
  console.log(`Total: ${testResults.length}`);
  console.log(`Passed: ${testResults.filter((test) => test.passed).length}`);
  console.log(`Failed: ${testResults.filter((test) => !test.passed).length}\n`);
  for (const category of categories) {
    const categoryTests = testResults.filter((test) => test.category === category);
    const passed = categoryTests.length > 0 && categoryTests.every((test) => test.passed);
    console.log(`${category}: ${passed ? "PASS" : "FAIL"}`);
  }
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown test runner error";
}

await main();
