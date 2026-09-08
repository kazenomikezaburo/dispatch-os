import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
// @ts-expect-error Native TypeScript execution requires the suffix.
import { createActorClients, prepareAuthFixtures } from "../integration/auth-fixtures.ts";

export const PARENT = {
  branch: "b0000000-0000-0000-0000-000000000001",
  project: "d26a0000-0000-0000-0000-000000000001",
  workplace: "d26a0000-0000-0000-0000-000000000002",
  job: "d26a0000-0000-0000-0000-000000000003",
} as const;
export const SCENARIOS = [
  { key: "scheduled", label: "Scheduled", expected: "勤務前", status: "confirmed" },
  { key: "start-missing", label: "Start Missing", expected: "開始未報告", status: "confirmed" },
  { key: "late", label: "Late", expected: "勤務中（開始 15分遅れ）", status: "confirmed" },
  { key: "working", label: "Working", expected: "勤務中", status: "confirmed" },
  { key: "finished", label: "Finished", expected: "勤務終了", status: "completed" },
  { key: "absent", label: "Absent", expected: "欠勤", status: "absent" },
  { key: "no-show", label: "No Show", expected: "無断欠勤", status: "no_show" },
  { key: "pre-shift-unavailable", label: "Pre-shift unavailable", expected: "要確認：前日確認で勤務不可", status: "confirmed" },
  { key: "placement-break", label: "Placement / Break", expected: "現在配置：受付 / 予定休憩", status: "confirmed" },
] as const;
type Key = (typeof SCENARIOS)[number]["key"];
export const IDS = Object.fromEntries(SCENARIOS.map((scenario, index) => [scenario.key, {
  worker: `d26a1000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
  shift: `d26a2000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
  assignment: `d26a3000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
}])) as Record<Key, { worker: string; shift: string; assignment: string }>;
const EVENT_IDS = Array.from({ length: 5 }, (_, index) => `d26a4000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`);
const POSITION_ID = "d26a5000-0000-0000-0000-000000000001";
const SEGMENT_ID = "d26a6000-0000-0000-0000-000000000001";
const BREAK_ID = "d26a7000-0000-0000-0000-000000000001";

export function assertLocalSupabaseUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "http:" || (url.hostname !== "127.0.0.1" && url.hostname !== "localhost")) throw new Error("Day-of fixture setup refused a non-local Supabase URL.");
  return url.origin;
}
export function fixtureIds() { return { workers: SCENARIOS.map(s => IDS[s.key].worker), shifts: SCENARIOS.map(s => IDS[s.key].shift), assignments: SCENARIOS.map(s => IDS[s.key].assignment), events: EVENT_IDS, parents: Object.values(PARENT), placement: [POSITION_ID, SEGMENT_ID, BREAK_ID] }; }
const iso = (anchor: Date, minutes: number) => new Date(anchor.getTime() + minutes * 60_000).toISOString();
export function times(anchor: Date, key: Key) {
  if (key === "scheduled" || key === "pre-shift-unavailable") return { start: iso(anchor, 180), end: iso(anchor, 360) };
  if (key === "finished") return { start: iso(anchor, -180), end: iso(anchor, -60) };
  return { start: iso(anchor, -120), end: iso(anchor, 180) };
}
const tokyoDate = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
function literals(values: string[]) { return values.map(value => `'${value}'`).join(","); }
function sqlLiteral(value: string) { return `'${value.replaceAll("'", "''")}'`; }
function pg(sql: string) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function localConfig() {
  const output = execFileSync(process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npx", process.platform === "win32" ? ["/d", "/s", "/c", "npx supabase status -o json"] : ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const value = JSON.parse(output) as { API_URL?: string; ANON_KEY?: string; SERVICE_ROLE_KEY?: string };
  const url = assertLocalSupabaseUrl(value.API_URL ?? "");
  if (!value.ANON_KEY || !value.SERVICE_ROLE_KEY) throw new Error("Local Supabase fixture keys are unavailable.");
  return { url, anonKey: value.ANON_KEY, serviceRoleKey: value.SERVICE_ROLE_KEY };
}
function cleanup() {
  const ids = fixtureIds(); const shifts = literals(ids.shifts); const assignments = literals(ids.assignments); const workers = literals(ids.workers); const events = literals(ids.events);
  pg(`begin;
    delete from public.assignment_break_intervals where plan_id in (select id from public.shift_placement_plans where shift_slot_id in (${shifts}));
    delete from public.assignment_placement_segments where plan_id in (select id from public.shift_placement_plans where shift_slot_id in (${shifts}));
    delete from public.shift_placement_plan_revisions where plan_id in (select id from public.shift_placement_plans where shift_slot_id in (${shifts}));
    delete from public.shift_positions where plan_id in (select id from public.shift_placement_plans where shift_slot_id in (${shifts}));
    delete from public.shift_placement_plans where shift_slot_id in (${shifts});
    delete from public.attendance_record_revisions where assignment_id in (${assignments}); delete from public.attendance_records where assignment_id in (${assignments});
    delete from public.attendance_events where id in (${events}); delete from public.pre_shift_confirmations where assignment_id in (${assignments});
    delete from public.assignments where id in (${assignments}); delete from public.shift_slots where id in (${shifts}); delete from public.workers where id in (${workers});
    delete from public.jobs where id='${PARENT.job}'; delete from public.projects where id='${PARENT.project}'; delete from public.workplaces where id='${PARENT.workplace}'; commit;`);
}
function counts() {
  const ids = fixtureIds(); const shifts = literals(ids.shifts); const assignments = literals(ids.assignments); const workers = literals(ids.workers); const events = literals(ids.events);
  const raw = pg(`select json_build_object('workers',(select count(*) from public.workers where id in (${workers})),'shift_slots',(select count(*) from public.shift_slots where id in (${shifts})),'assignments',(select count(*) from public.assignments where id in (${assignments})),'attendance_events',(select count(*) from public.attendance_events where id in (${events})),'pre_shift_confirmations',(select count(*) from public.pre_shift_confirmations where assignment_id in (${assignments})),'placement_plans',(select count(*) from public.shift_placement_plans where shift_slot_id in (${shifts})))::text;`);
  const result = JSON.parse(raw) as Record<string, number>; result.total = Object.values(result).reduce((sum, value) => sum + value, 0); return result;
}
async function setup(anchor: Date, manager: Awaited<ReturnType<typeof createActorClients>>["managerA"]) {
  cleanup(); if (pg(`select count(*) from public.branches where id='${PARENT.branch}'`) !== "1") throw new Error("Required local Manager branch fixture is missing.");
  const dates = SCENARIOS.map(s => tokyoDate(times(anchor, s.key).start)).sort();
  const workers = SCENARIOS.map((s, i) => `('${IDS[s.key].worker}','DAYOF-QA-${String(i + 1).padStart(2, "0")}','${PARENT.branch}',${sqlLiteral(`DAY-OF QA / ${s.label}`)},'active')`).join(",");
  const shifts = SCENARIOS.map(s => { const t = times(anchor, s.key); return `('${IDS[s.key].shift}','${PARENT.job}',${sqlLiteral(`DAY-OF QA / ${s.label}`)},'${t.start}','${t.end}',1,${s.key === "placement-break" ? 30 : "null"},'confirmed')`; }).join(",");
  const assignments = SCENARIOS.map(s => `('${IDS[s.key].assignment}','${IDS[s.key].shift}','${IDS[s.key].worker}','manager','${s.status}')`).join(",");
  const late = times(anchor, "late"), working = times(anchor, "working"), finished = times(anchor, "finished"), placement = times(anchor, "placement-break"), unavailable = times(anchor, "pre-shift-unavailable");
  const events = [
    [EVENT_IDS[0], IDS.late.assignment, "start_work", iso(new Date(late.start), 15)], [EVENT_IDS[1], IDS.working.assignment, "start_work", working.start],
    [EVENT_IDS[2], IDS.finished.assignment, "start_work", finished.start], [EVENT_IDS[3], IDS.finished.assignment, "end_work", finished.end],
    [EVENT_IDS[4], IDS["placement-break"].assignment, "start_work", placement.start],
  ].map(e => `('${e[0]}','${e[1]}','${e[2]}','${e[3]}','${e[3]}','system','${e[0]}')`).join(",");
  pg(`begin; insert into public.workplaces(id,branch_id,name,address) values('${PARENT.workplace}','${PARENT.branch}','DAY-OF QA Workplace','Local QA only');
    insert into public.projects(id,branch_id,name,status,start_date,end_date) values('${PARENT.project}','${PARENT.branch}','DAY-OF QA Matrix','in_progress','${dates[0]}','${dates.at(-1)}');
    insert into public.jobs(id,project_id,workplace_id,name,status) values('${PARENT.job}','${PARENT.project}','${PARENT.workplace}','DAY-OF QA Operations','in_progress');
    insert into public.workers(id,staff_code,branch_id,display_name,status) values ${workers};
    insert into public.shift_slots(id,job_id,label,starts_at,ends_at,required_workers,break_minutes,status) values ${shifts};
    insert into public.assignments(id,shift_slot_id,worker_id,source,status) values ${assignments};
    insert into public.attendance_events(id,assignment_id,event_type,client_occurred_at,server_received_at,source,idempotency_key) values ${events};
    insert into public.pre_shift_confirmations(id,assignment_id,can_work,health_status,submitted_at) values('d26a8000-0000-0000-0000-000000000001','${IDS["pre-shift-unavailable"].assignment}',false,'good','${iso(new Date(unavailable.start), -1440)}'); commit;`);
  const rpc = await manager.rpc("save_shift_placement_plan", { p_shift_slot_id: IDS["placement-break"].shift, p_expected_version: 0, p_idempotency_key: "day-of-qa-placement-v1", p_reason: "Local QA fixture setup", p_positions: [{ id: POSITION_ID, label: "受付", required_workers: 1, display_order: 0, retired: false }], p_placement_segments: [{ id: SEGMENT_ID, assignment_id: IDS["placement-break"].assignment, position_id: POSITION_ID, start_at: iso(anchor, -30), end_at: iso(anchor, 30) }], p_break_intervals: [{ id: BREAK_ID, assignment_id: IDS["placement-break"].assignment, start_at: iso(anchor, 30), end_at: iso(anchor, 60) }] });
  if (rpc.error || (rpc.data as { ok?: boolean })?.ok !== true) throw new Error("Placement fixture RPC failed");
  return SCENARIOS.map(s => { const t = times(anchor, s.key); const date = tokyoDate(t.start); return { scenario: s.label, date, shiftId: IDS[s.key].shift, assignmentId: IDS[s.key].assignment, worker: `DAY-OF QA / ${s.label}`, expected: s.expected, url: `/admin/day-of?date=${date}&assignment=${IDS[s.key].assignment}` }; });
}
async function main() {
  const mode = process.argv[2] ?? "status"; if (!["setup", "cleanup", "status"].includes(mode)) throw new Error("Usage: setup-day-of-fixtures.ts <setup|cleanup|status>"); const config = localConfig();
  if (mode === "status") { console.log(JSON.stringify({ mode, counts: counts() }, null, 2)); return; }
  if (mode === "cleanup") { cleanup(); console.log(JSON.stringify({ mode, counts: counts() }, null, 2)); return; }
  await prepareAuthFixtures(config); const actors = await createActorClients(config); const anchor = new Date(); const manifest = await setup(anchor, actors.managerA); console.log(JSON.stringify({ mode, anchor: anchor.toISOString(), manifest, counts: counts() }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error instanceof Error ? error.message : "Day-of fixture operation failed"); process.exitCode = 1; });
