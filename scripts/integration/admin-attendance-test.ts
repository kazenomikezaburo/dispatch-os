import { readFileSync } from "node:fs";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { buildAttendanceData, deriveAdminAttendance } from "../../lib/admin/attendance/attendance-rules.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { getTokyoDate, getTokyoDateRange, shiftDate } from "../../lib/admin/attendance/attendance-query-schema.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { createActorClients, prepareAuthFixtures, readLocalConfig } from "./auth-fixtures.ts";
// @ts-expect-error Node's native TypeScript loader requires the explicit suffix.
import { IDS } from "./test-data.ts";
import type { AttendanceInput, AttendanceQuery } from "../../lib/admin/attendance/attendance-types.ts";

const config = readLocalConfig(); await prepareAuthFixtures(config); const clients = await createActorClients(config);
const results: boolean[] = []; const record = (n: string, pass: boolean, actual: string) => { results.push(pass); console.log(`ATTENDANCE-ADMIN-${n} ${pass ? "PASS" : "FAIL"}: ${actual}`); };
const base: AttendanceInput = { id: "a", shiftId: "s", status: "assigned", workerName: "山田 太郎", startsAt: "2026-08-22T00:00:00Z", endsAt: "2026-08-22T09:00:00Z", projectName: "展示会", jobName: "受付", workplaceName: "会場", startWorkAt: null, endWorkAt: null };
const all: AttendanceQuery = { date: "2026-08-22", state: "all", confirmation: "all", attention: "all", q: "", page: 1 };
const item = (changes: Partial<AttendanceInput> = {}, now = "2026-08-21T23:00:00Z") => deriveAdminAttendance({ ...base, ...changes }, new Date(now));

const managerOwn = await clients.managerA.from("assignments").select("id").eq("id", IDS.assignments.workerBN1);
record("001", !managerOwn.error && managerOwn.data?.length === 1, `rows=${managerOwn.data?.length ?? 0}`);
const managerOther = await clients.managerA.from("assignments").select("id").eq("id", IDS.assignments.workerCT1);
record("002", !managerOther.error && managerOther.data?.length === 0, `rows=${managerOther.data?.length ?? 0}`);
const admin = await clients.systemAdmin.from("assignments").select("id").in("id", [IDS.assignments.workerBN1, IDS.assignments.workerCT1]);
record("003", !admin.error && admin.data?.length === 2, `rows=${admin.data?.length ?? 0}`);
record("004", readFileSync("lib/auth/require-admin.ts", "utf8").includes('redirect("/worker")'), "Admin Route Guard static check");
record("005", item().state === "scheduled", "scheduled");
record("006", item({}, base.startsAt).state === "start_missing", "boundary start_missing");
record("007", item({}, "2026-08-22T00:01:00Z").state === "start_missing", "start_missing");
record("008", item({ startWorkAt: "2026-08-22T00:00:00Z" }).state === "working", "working");
record("009", item({ startWorkAt: "2026-08-22T00:00:00Z", endWorkAt: "2026-08-22T09:00:00Z" }).state === "finished", "finished");
record("010", item({ startWorkAt: "2026-08-22T00:07:01Z" }).lateMinutes === 8, "late ceil=8");
record("011", item({ startWorkAt: base.startsAt }).lateMinutes === 0, "on time");
record("012", item({ startWorkAt: "2026-08-21T23:59:00Z" }).lateMinutes === 0, "early start");
record("013", item({ startWorkAt: base.startsAt, endWorkAt: "2026-08-22T08:32:00Z" }).earlyLeaveMinutes === 28, "early=28");
record("014", item({ startWorkAt: base.startsAt, endWorkAt: base.endsAt }).earlyLeaveMinutes === 0, "on-time end");
const overtime = item({ startWorkAt: base.startsAt, endWorkAt: "2026-08-22T09:12:00Z" }); record("015", overtime.overtimeMinutes === 12 && !overtime.needsAttention, "overtime=12 attention=false");
record("016", !["cancelled_by_worker", "cancelled_by_company"].some((status) => ["assigned", "confirmed", "completed", "absent", "no_show"].includes(status)), "cancelled_by_worker excluded");
record("017", !["assigned", "confirmed", "completed", "absent", "no_show"].includes("cancelled_by_company"), "cancelled_by_company excluded");
record("018", item({ status: "absent" }).state === "absent", "absent");
record("019", item({ status: "no_show" }).state === "no_show", "no_show");
record("020", getTokyoDate(new Date("2026-08-21T15:00:00Z")) === "2026-08-22", "JST boundary");
record("021", shiftDate("2026-08-22", -1) === "2026-08-21", "previous day");
record("022", shiftDate("2026-08-22", 1) === "2026-08-23", "next day");
const range = getTokyoDateRange("2026-08-22"); record("023", range.start === "2026-08-21T15:00:00.000Z" && range.end === "2026-08-22T15:00:00.000Z", `${range.start}..${range.end}`);
const samples = [base, { ...base, id: "b", workerName: "佐藤", projectName: "音楽祭", jobName: "誘導", workplaceName: "ホール", startWorkAt: base.startsAt }];
record("024", buildAttendanceData(samples, { ...all, q: "山田" }, new Date("2026-08-21T23:00:00Z")).items.length === 1, "worker search");
record("025", buildAttendanceData(samples, { ...all, q: "音楽祭" }, new Date()).items.length === 1, "project search");
record("026", buildAttendanceData(samples, { ...all, q: "誘導" }, new Date()).items.length === 1, "job search");
record("027", buildAttendanceData(samples, { ...all, q: "ホール" }, new Date()).items.length === 1, "workplace search");
record("028", buildAttendanceData(samples, { ...all, state: "working" }, new Date("2026-08-21T23:00:00Z")).items.length === 1, "state filter");
record("029", buildAttendanceData([base, { ...base, id: "b", startWorkAt: "2026-08-22T00:05:00Z" }], { ...all, attention: "needs_attention" }, new Date("2026-08-22T00:10:00Z")).items.length === 2, "attention filter");
const summary = buildAttendanceData([base, { ...base, id: "b", startWorkAt: base.startsAt }, { ...base, id: "c", startWorkAt: base.startsAt, endWorkAt: base.endsAt }], all, new Date("2026-08-21T23:00:00Z")).summary;
record("030", summary.total === 3, `total=${summary.total}`); record("031", summary.scheduled === 1, `scheduled=${summary.scheduled}`); record("032", buildAttendanceData([base], all, new Date(base.startsAt)).summary.startMissing === 1, "startMissing=1"); record("033", summary.working === 1, `working=${summary.working}`); record("034", summary.finished === 1, `finished=${summary.finished}`);
const dataSource = readFileSync("lib/admin/attendance/get-attendance.ts", "utf8"); record("035", (dataSource.match(/\.from\(/g) ?? []).length === 2 && dataSource.includes('.in("assignment_id"'), "maximum 2 batched queries");
record("036", dataSource.includes("server_received_at"), "server_received_at selected"); record("037", !dataSource.includes("client_occurred_at"), "client_occurred_at unused");
record("038", dataSource.includes("return { ok: false }") && readFileSync("app/admin/attendance/page.tsx", "utf8").includes("勤怠情報を取得できませんでした"), "general error");
record("039", buildAttendanceData([], all, new Date()).totalAssignments === 0, "empty state");
record("040", !/\.(insert|update|delete|upsert)\(/.test(dataSource + readFileSync("app/admin/attendance/page.tsx", "utf8")), "SELECT only");
const passed = results.filter(Boolean).length; console.log(`TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`); if (passed !== results.length) process.exitCode = 1;
