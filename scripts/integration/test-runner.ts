import type { PostgrestError } from "@supabase/supabase-js";

export type Category = "Authentication" | "Data API Grants" | "RLS" | "IDOR" |
  "Privilege Escalation" | "Attendance Integrity" | "Anonymous Access";
export type Layer = "AUTH" | "GRANT" | "RLS" | "CONSTRAINT" | "NONE" | "UNKNOWN";

export type Outcome = {
  error: PostgrestError | null;
  status: number;
  rows: number;
};

type Result = {
  id: string; category: Category; actor: string; action: string; target: string;
  expected: string; actual: string; layer: Layer; status: number;
  code: string; message: string; passed: boolean;
};

export class TestRunner {
  private results: Result[] = [];

  classify(outcome: Outcome): Layer {
    const message = outcome.error?.message.toLowerCase() ?? "";
    const code = outcome.error?.code ?? "";
    if (!outcome.error) return "NONE";
    if (code === "42501" && message.includes("permission denied")) return "GRANT";
    if (code === "42501" && message.includes("row-level security")) return "RLS";
    if (["23502", "23503", "23505", "23514"].includes(code)) return "CONSTRAINT";
    return "UNKNOWN";
  }

  record(input: Omit<Result, "passed"> & { passed: boolean }): void {
    this.results.push(input);
    console.log(`${input.id}: ${input.passed ? "PASS" : "FAIL"} [${input.layer}] ${input.actual}`);
  }

  expectRows(id: string, category: Category, actor: string, target: string,
    outcome: Outcome, expectedRows: number): void {
    this.record({ id, category, actor, action: "SELECT", target,
      expected: `${expectedRows} row(s)`, actual: outcome.error ? "ERROR" : `${outcome.rows} row(s)`,
      layer: this.classify(outcome), status: outcome.status, code: outcome.error?.code ?? "",
      message: outcome.error?.message ?? "", passed: !outcome.error && outcome.rows === expectedRows });
  }

  expectAllowed(id: string, category: Category, actor: string, action: string,
    target: string, outcome: Outcome): void {
    this.record({ id, category, actor, action, target, expected: "ALLOW",
      actual: outcome.error ? "DENY" : "ALLOW", layer: this.classify(outcome),
      status: outcome.status, code: outcome.error?.code ?? "", message: outcome.error?.message ?? "",
      passed: !outcome.error && outcome.rows > 0 });
  }

  expectDenied(id: string, category: Category, actor: string, action: string,
    target: string, outcome: Outcome, requiredLayer?: Layer): void {
    const layer = this.classify(outcome);
    const securityError = outcome.error !== null && (layer === "GRANT" || layer === "RLS");
    const rlsInvisible = !outcome.error && outcome.rows === 0;
    const actualLayer = rlsInvisible ? "RLS" : layer;
    this.record({ id, category, actor, action, target, expected: "DENY",
      actual: securityError || rlsInvisible ? "DENY" : outcome.error ? "ERROR" : "ALLOW",
      layer: actualLayer, status: outcome.status, code: outcome.error?.code ?? "",
      message: outcome.error?.message ?? "",
      passed: (securityError || rlsInvisible) && (!requiredLayer || actualLayer === requiredLayer) });
  }

  finish(): void {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.length - passed;
    console.log("\nDATA API SECURITY TEST RESULT");
    console.log(`Total: ${this.results.length}\nPassed: ${passed}\nFailed: ${failed}\n`);
    const categories: Category[] = ["Authentication", "Data API Grants", "RLS", "IDOR",
      "Privilege Escalation", "Attendance Integrity", "Anonymous Access"];
    for (const category of categories) {
      const items = this.results.filter((r) => r.category === category);
      console.log(`${category}: ${items.length > 0 && items.every((r) => r.passed) ? "PASS" : "FAIL"} (${items.length})`);
    }
    if (failed) {
      console.error("\nFailed tests:");
      for (const r of this.results.filter((item) => !item.passed)) {
        console.error(`${r.id} Actual=${r.actual} Layer=${r.layer} HTTP=${r.status} Code=${r.code} Message=${r.message}`);
      }
      process.exitCode = 1;
    }
  }
}

export function outcome(response: { data: unknown; error: PostgrestError | null; status: number }): Outcome {
  const rows = Array.isArray(response.data) ? response.data.length : response.data ? 1 : 0;
  return { error: response.error, status: response.status, rows };
}

