import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAttentionData } from "../../lib/admin/attention/attention-rules.ts";

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const page = await readFile(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");
const list = await readFile(new URL("../../components/admin/dashboard/dashboard-attention-list.tsx", import.meta.url), "utf8");
const summary = await readFile(new URL("../../components/admin/dashboard/dashboard-summary.tsx", import.meta.url), "utf8");

ok(page.includes("getAdminAttention(now)"), "Home reuses the canonical Attention composer");
ok(page.includes("getDashboardData(now)"), "Home keeps the existing operational Shift summary");
ok(page.includes("Promise.all"), "Home reads independent summaries concurrently");
ok(page.includes("items.slice(0, 4)"), "Home bounds the top Attention preview to four items");
assert.doesNotMatch(page, /DashboardAlertList|buildDashboardData\(|staffing_shortage|pre_confirmation_overdue|day_of_arrival/); checks += 1;
ok(list.includes('href="/admin/attention"'), "Home links to the complete Attention Center");
ok(list.includes("href={item.destination}"), "Home actions preserve canonical destinations from the composer");
ok(list.includes("{item.actionLabel}"), "Home preserves canonical action labels");
ok(summary.includes("attention.total"), "Home count uses the canonical Attention summary");
ok(summary.includes("attention.urgent"), "Home SOS count uses the canonical Attention summary");

const base = { shiftId:"shift", projectId:"project", projectName:"案件", workplaceName:"現場", startsAt:"2099-01-02T00:00:00.000Z" };
const data = buildAttentionData({
  staffing:[{...base,jobName:"受付",requiredWorkers:2,assignedWorkers:1,staffingState:"shortage"}],
  placement:[],preConfirmations:[],dayOf:[],
  incidents:[{...base,incidentId:"incident",assignmentId:"assignment",workerName:"田中",createdAt:"2099-01-01T23:00:00.000Z",state:"open"}],
  attendanceReviews:[],
},{from:"2099-01-01T15:00:00.000Z",to:"2099-01-09T15:00:00.000Z"});
equal(data.items.slice(0, 4).map(item => item.id), data.items.map(item => item.id), "Home preview preserves composer ordering");
equal(data.summary.total, 2, "Home count and Attention Center count share the same summary");
ok(data.items.every(item => item.destination.startsWith("/admin/")), "preview actions remain canonical Admin routes");

console.log(`Action-first Admin Home: PASS (${checks} assertions)`);
