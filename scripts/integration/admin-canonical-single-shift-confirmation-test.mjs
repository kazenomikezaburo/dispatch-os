import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveSingleShiftConfirmationPhase, singleShiftConfirmationHref } from "../../lib/admin/shifts/single-shift-confirmation-rules.ts";

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const match = (value, pattern, message) => { assert.match(value, pattern, message); checks += 1; };
const noMatch = (value, pattern, message) => { assert.doesNotMatch(value, pattern, message); checks += 1; };
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [page, rules, phaseNav, preLoader, dayLoader, preMonitor, dayMonitor, preDrawer, dayDrawer, routes] = await Promise.all([
  read("app/admin/shifts/[shiftId]/page.tsx"), read("lib/admin/shifts/single-shift-confirmation-rules.ts"), read("components/admin/shifts/confirmation-phase-nav.tsx"), read("lib/admin/pre-shift/get-pre-shift-monitor.ts"), read("lib/admin/day-of/get-day-of.ts"), read("components/admin/pre-shift/pre-shift-monitor.tsx"), read("components/admin/day-of/day-of-monitor.tsx"), read("components/admin/pre-shift/pre-shift-drawer.tsx"), read("components/admin/day-of/day-of-drawer.tsx"), read("components/admin/admin-detail-workflow-routes.ts"),
]);

equal(resolveSingleShiftConfirmationPhase("pre", "2020-01-01T00:00:00Z", new Date("2030-01-01T00:00:00Z")).phase, "pre", "explicit pre wins");
equal(resolveSingleShiftConfirmationPhase("day", "2099-01-01T00:00:00Z", new Date("2020-01-01T00:00:00Z")).phase, "day", "explicit day wins");
equal(resolveSingleShiftConfirmationPhase(undefined, "2099-01-15T01:00:00Z", new Date("2099-01-14T14:59:59Z")).phase, "pre", "Tokyo prior day defaults pre");
equal(resolveSingleShiftConfirmationPhase(undefined, "2099-01-15T01:00:00Z", new Date("2099-01-14T15:00:00Z")).phase, "day", "Tokyo shift date defaults day");
equal(resolveSingleShiftConfirmationPhase("invalid", "2099-01-15T01:00:00Z", new Date("2099-01-14T14:00:00Z")).canonical, false, "invalid phase canonicalizes");
equal(resolveSingleShiftConfirmationPhase(["day", "pre"], "2099-01-15T01:00:00Z").phase, "day", "first explicit phase wins");
equal(singleShiftConfirmationHref("shift id", "pre"), "/admin/shifts/shift%20id?tab=confirmation&phase=pre", "pre URL");
equal(singleShiftConfirmationHref("s", "day", "a b"), "/admin/shifts/s?tab=confirmation&phase=day&assignmentId=a+b", "drawer URL");

for (const label of ["概要", "応募", "配置", "確認"]) match(page, new RegExp(`label: "${label}"`), `${label} main tab`);
noMatch(page, /label: "履歴"/, "no history main tab");
match(phaseNav, /前日確認/, "pre phase switch");
match(phaseNav, /当日確認/, "day phase switch");
match(phaseNav, /aria-label="確認フェーズ"/, "semantic phase nav");
match(phaseNav, /aria-current/, "phase current state");
match(phaseNav, /min-h-11/, "44px switch target");
match(phaseNav, /focus-visible/, "visible switch focus");
match(page, /resolveSingleShiftConfirmationPhase\(query\.phase, detail\.startsAt\)/, "server phase resolution");
match(page, /redirect\(singleShiftConfirmationHref/, "server canonical redirect");
match(page, /allowedKeys = new Set/, "query allowlist");
match(page, /requestedTab === "confirmations"/, "legacy confirmation alias");
match(page, /getPreShiftMonitor\(shiftDate, detail\.id\)/, "exact pre loader call");
match(page, /getDayOf\(dayQuery, new Date\(\), detail\.id\)/, "exact day loader call");
match(preLoader, /exactShiftId/, "pre exact shift parameter");
match(preLoader, /\.eq\("shift_slot_id", exactShiftId\)/, "pre DB exact shift predicate");
match(dayLoader, /exactShiftId/, "day exact shift parameter");
match(dayLoader, /\.eq\("shift_slot_id",exactShiftId\)/, "day DB exact shift predicate");
noMatch(page, /items\[0\]|assignments\[0\]/, "no first item fallback");
match(page, /tokyoDate\(detail\.startsAt\)/, "Shift Tokyo date");
match(page, /PreShiftMonitor/, "pre presentation reuse");
match(page, /DayOfMonitor/, "day presentation reuse");
match(page, /PreShiftDrawer/, "pre drawer reuse");
match(page, /DayOfDrawer/, "day drawer reuse");
match(preMonitor, /assignmentHref\?\./, "pre canonical drawer href hook");
match(dayMonitor, /assignmentHref\?\./, "day canonical drawer href hook");
match(page, /find\(\(item\) => item\.assignmentId === requestedConfirmationAssignmentId\)/, "exact assignment selection");
match(page, /AdminNotFoundState/, "safe missing assignment");
match(preDrawer, /router\.push\(closeHref/, "pre canonical close");
match(dayDrawer, /router\.push\(closeHref/, "day canonical close");
match(preDrawer, /assignment-\$\{item\.assignmentId\}/, "pre focus restore exact trigger");
match(dayDrawer, /assignment-\$\{item\.assignmentId\}/, "day focus restore exact trigger");
match(dayDrawer, /\/admin\/attendance\/\$\{item\.assignmentId\}/, "exact Attendance link");
match(dayDrawer, /incidentAttention/, "Incident read context retained");
noMatch(dayDrawer, /acknowledge|resolveIncident|updateIncident/, "no Incident lifecycle mutation");
noMatch(page, /Attendance.*Form|attendance.*action/i, "no Attendance editor duplication");
match(dayLoader, /buildDayOfItems/, "shared Day-of mapper");
match(dayLoader, /attendance_events/, "existing Attendance facts");
match(dayLoader, /operational_incidents/, "existing Incident facts");
match(rules, /tokyoDate\(now\) < tokyoDate\(shiftStartsAt\)/, "Tokyo calendar comparison");
match(routes, /"overview" \| "applications" \| "placement" \| "confirmation"/, "four-tab contract unchanged");
noMatch(page + rules + phaseNav, /@\/components\/worker|\/worker\//, "no Worker coupling");
noMatch(page + rules, /supabase\.from|\.rpc\(/, "page and phase rules add no DB writes");
check(checks >= 44, "focused suite has at least 44 checks");

console.log(`Admin canonical Single-Shift Confirmation: PASS (${checks} assertions)`);
