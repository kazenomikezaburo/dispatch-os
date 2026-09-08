// Pure Placement rules tests. No network, Auth, fixtures or DB writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import Module, { createRequire } from 'node:module';

const loadTs = createRequire(import.meta.url);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, ...args);
};
loadTs.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText, filename);
};
const rules = loadTs('../../lib/admin/placement/placement-rules.ts');
const views = loadTs('../../lib/admin/shifts/shift-view-rules.ts');
const { readAllPages } = loadTs('../../lib/admin/shifts/read-all-pages.ts');
let count = 0;
async function test(name, fn) { await fn(); count++; console.log(`PASS ${name}`); }
const now = new Date('2026-09-05T15:00:00Z');
const parse = (raw = {}) => rules.parsePlacementQuery(raw, now);
const row = (id = 'shift-a', patch = {}) => ({
  id, starts_at: '2099-01-27T00:00:00Z', ends_at: '2099-01-27T09:00:00Z',
  required_workers: 3, break_minutes: 60, status: 'recruiting',
  jobs: { name: 'Reception', projects: { id: 'project-a', name: 'TEST Project' }, workplaces: { name: '名古屋会場' } },
  ...patch,
});
const assignment = (id, status = 'assigned', patch = {}) => ({
  id, shift_slot_id: 'shift-a', status,
  workers: { id: `worker-${id}`, display_name: `Staff ${id}`, staff_code: `CODE-${id}` }, ...patch,
});
const single = (rows = []) => rules.buildPlacement([row()], rows)[0];

await test('unset planned break remains null, not a fabricated zero', () => {
  assert.equal(rules.buildPlacement([row('unset', { break_minutes: null })], [])[0].breakMinutes, null);
  assert.equal(rules.buildPlacement([row('zero', { break_minutes: 0 })], [])[0].breakMinutes, 0);
});

await test('default date rolls over at Tokyo midnight', () => assert.equal(parse().date, '2026-09-06'));
await test('one millisecond before Tokyo midnight stays previous day', () => assert.equal(rules.parsePlacementQuery({}, new Date('2026-09-05T14:59:59.999Z')).date, '2026-09-05'));
await test('explicit valid date wins over today', () => assert.equal(parse({ date: '2099-01-27' }).date, '2099-01-27'));
await test('invalid civil dates fall back instead of normalizing', () => {
  for (const date of ['abc', '2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-2-3', '0000-01-01', '9999-12-31']) {
    assert.equal(parse({ date }).date, '2026-09-06', date);
  }
});
await test('leap day and century rule are real calendar validation', () => {
  assert.equal(parse({ date: '2028-02-29' }).date, '2028-02-29');
  assert.equal(parse({ date: '2000-02-29' }).date, '2000-02-29');
  assert.equal(parse({ date: '2100-02-29' }).date, '2026-09-06');
});
await test('first repeated query values are authoritative', () => assert.deepEqual(parse({ date: ['2099-01-27', 'bad'], staffing: ['filled', 'shortage'], page: ['2', '8'] }), { ...parse(), date: '2099-01-27', staffing: 'filled', page: 2 }));
await test('query trims and bounds search and retains unmatched IDs', () => {
  const query = parse({ q: `  ${'a'.repeat(120)}  `, project: 'not-a-uuid', shift: 'x'.repeat(150) });
  assert.equal(query.q.length, 100); assert.equal(query.project, 'not-a-uuid'); assert.equal(query.shift.length, 100);
});
await test('invalid staffing and page fall back', () => {
  for (const page of ['0', '-1', '1.5', 'NaN', '9007199254740992']) assert.equal(parse({ page }).page, 1);
  assert.equal(parse({ staffing: 'unassigned' }).staffing, 'all');
});
await test('date range is exact Tokyo inclusive-start exclusive-end', () => assert.deepEqual(rules.placementRange('2099-01-27'), { start: '2099-01-26T15:00:00.000Z', end: '2099-01-27T15:00:00.000Z' }));
await test('year-end range and leap-day range stay one day', () => {
  for (const date of ['2026-12-31', '2028-02-29']) {
    const range = rules.placementRange(date);
    assert.equal(Date.parse(range.end) - Date.parse(range.start), 86_400_000);
    assert.equal(views.tokyoDate(range.start), date);
  }
});
await test('invalid direct range call rejects', () => assert.throws(() => rules.placementRange('2026-02-30'), /Invalid placement date/));
await test('overnight Shift belongs to start date only', () => {
  const shifts = rules.buildPlacement([row('overnight', { starts_at: '2099-01-27T14:00:00Z', ends_at: '2099-01-27T17:00:00Z' })], []);
  const grouped = views.groupShiftsByDay(shifts, ['2099-01-27', '2099-01-28']);
  assert.equal(grouped.get('2099-01-27').length, 1); assert.equal(grouped.get('2099-01-28').length, 0);
  assert.match(views.shiftTimeLabel(shifts[0]), /23:00.*02:00/);
});
await test('midnight belongs to next day, never both days', () => {
  const shifts = rules.buildPlacement([row('midnight', { starts_at: '2099-01-27T15:00:00Z', ends_at: '2099-01-28T00:00:00Z' })], []);
  const grouped = views.groupShiftsByDay(shifts, ['2099-01-27', '2099-01-28']);
  assert.equal(grouped.get('2099-01-27').length, 0); assert.equal(grouped.get('2099-01-28').length, 1);
});
await test('all three shared active states contribute to staff and count', () => {
  const shift = single(['assigned', 'confirmed', 'completed'].map((status, index) => assignment(String(index), status)));
  assert.equal(shift.assignedWorkers, 3); assert.equal(shift.staff.length, 3); assert.equal(shift.shortage, 0);
});
await test('both cancellations, absent and no-show do not count or display', () => {
  const shift = single(['cancelled_by_worker', 'cancelled_by_company', 'absent', 'no_show'].map((status, index) => assignment(String(index), status)));
  assert.equal(shift.assignedWorkers, 0); assert.deepEqual(shift.staff, []); assert.equal(shift.shortage, 3);
});
await test('shortage uses required minus active assignments', () => { const shift = single([assignment('a')]); assert.equal(shift.assignedWorkers, 1); assert.equal(shift.shortage, 2); });
await test('over-capacity historical data clamps shortage at zero', () => assert.equal(single(Array.from({ length: 4 }, (_, i) => assignment(String(i)))).shortage, 0));
await test('staff details and planned break remain existing facts', () => {
  const shift = single([assignment('a', 'confirmed')]);
  assert.equal(shift.breakMinutes, 60);
  assert.deepEqual(shift.staff[0], { assignmentId: 'a', status: 'confirmed', worker: { id: 'worker-a', name: 'Staff a', staffCode: 'CODE-a' } });
});
await test('missing worker preserves staffing but exposes no hidden ID', () => {
  const shift = single([assignment('a', 'assigned', { workers: null, worker_id: 'hidden-worker' })]);
  assert.equal(shift.assignedWorkers, 1); assert.equal(shift.shortage, 2); assert.equal(shift.staff[0].worker, null);
  assert.equal(JSON.stringify(shift).includes('hidden-worker'), false);
});
await test('unrelated Assignment cannot enter visible Shift', () => assert.equal(single([assignment('a', 'assigned', { shift_slot_id: 'other-branch-shift' })]).assignedWorkers, 0));
await test('missing Job or Project cannot create a visible board row', () => {
  const rows = [row('hidden-job', { jobs: null }), row('hidden-project', { jobs: { name: 'Hidden', projects: null, workplaces: null } })];
  assert.deepEqual(rules.buildPlacement(rows, [assignment('a', 'assigned', { shift_slot_id: 'hidden-project' })]), []);
});
await test('missing workplace uses safe fallback without dropping Shift', () => {
  const actual = rules.buildPlacement([row('shift-a', { jobs: { ...row().jobs, workplaces: null } })], []);
  assert.equal(actual.length, 1); assert.equal(actual[0].workplaceName, '勤務先情報を表示できません');
});
await test('Shift sort is instant then ID, not input order or staffing', () => {
  const rows = [row('b'), row('c', { starts_at: '2099-01-27T10:00:00+09:00' }), row('a')];
  assert.deepEqual(rules.buildPlacement(rows, [assignment('filled')]).map((shift) => shift.id), ['a', 'b', 'c']);
  assert.deepEqual(rows.map((shift) => shift.id), ['b', 'c', 'a']);
});
await test('equivalent timestamps use stable ID tie-break', () => {
  assert.deepEqual(rules.buildPlacement([row('b', { starts_at: '2099-01-27T09:00:00+09:00' }), row('a')], []).map((shift) => shift.id), ['a', 'b']);
});
await test('staff sort uses name then Assignment ID without input mutation', () => {
  const assignments = [assignment('b', 'assigned', { workers: { id: 'b', display_name: 'Same', staff_code: 'B' } }), assignment('a', 'assigned', { workers: { id: 'a', display_name: 'Same', staff_code: 'A' } })];
  assert.deepEqual(single(assignments).staff.map((staff) => staff.assignmentId), ['a', 'b']);
  assert.equal(assignments[0].id, 'b');
});
const board = rules.buildPlacement([row(), row('shift-b', { required_workers: 1, jobs: { name: 'Kitchen', projects: { id: 'project-b', name: 'Second' }, workplaces: { name: '東京会場' } } })], [assignment('a'), assignment('b', 'completed', { shift_slot_id: 'shift-b' })]);
await test('search matches project, job and workplace case-insensitively', () => {
  for (const q of ['test project', 'RECEPTION', '名古屋']) assert.deepEqual(rules.filterPlacement(board, parse({ q })).map((shift) => shift.id), ['shift-a']);
  assert.deepEqual(rules.filterPlacement(board, parse({ q: 'absent-search' })), []);
});
await test('project and Shift filters compose', () => {
  assert.deepEqual(rules.filterPlacement(board, parse({ project: 'project-b', shift: 'shift-b' })).map((shift) => shift.id), ['shift-b']);
  assert.deepEqual(rules.filterPlacement(board, parse({ project: 'project-a', shift: 'shift-b' })), []);
});
await test('invalid or cross-branch IDs yield no rows, never broaden', () => {
  assert.deepEqual(rules.filterPlacement(board, parse({ project: 'invalid' })), []);
  assert.deepEqual(rules.filterPlacement(board, parse({ shift: 'cross-branch-shift' })), []);
});
await test('staffing shortage includes unassigned and filled excludes shortage', () => {
  assert.deepEqual(rules.filterPlacement(board, parse({ staffing: 'shortage' })).map((shift) => shift.id), ['shift-a']);
  assert.deepEqual(rules.filterPlacement(board, parse({ staffing: 'filled' })).map((shift) => shift.id), ['shift-b']);
  assert.equal(rules.filterPlacement([single()], parse({ staffing: 'shortage' })).length, 1);
});
await test('summary is exact across visible rows', () => assert.deepEqual(rules.summarizePlacement(board), { shifts: 2, required: 4, assigned: 2, shortage: 2, filled: 1, shortageShifts: 1 }));
await test('empty summary is all zero', () => assert.deepEqual(rules.summarizePlacement([]), { shifts: 0, required: 0, assigned: 0, shortage: 0, filled: 0, shortageShifts: 0 }));
await test('URL encodes all filters and explicit page', () => {
  const query = parse({ date: '2099-01-27', q: '日本 & Staff', project: 'project-a', shift: 'shift-a', staffing: 'shortage', page: '2' });
  const url = new URL(rules.placementHref(query), 'http://localhost');
  assert.equal(url.pathname, '/admin/placement');
  for (const [key, value] of Object.entries(query)) assert.equal(url.searchParams.get(key), String(value));
  assert.deepEqual(parse(Object.fromEntries(url.searchParams)), query);
});
await test('date navigation patch preserves filters and can reset page', () => {
  const query = parse({ q: 'Project', project: 'project-a', staffing: 'shortage', page: '4' });
  const url = new URL(rules.placementHref(query, { date: '2099-01-28', page: 1 }), 'http://localhost');
  assert.equal(url.searchParams.get('date'), '2099-01-28'); assert.equal(url.searchParams.get('q'), 'Project');
  assert.equal(url.searchParams.get('project'), 'project-a'); assert.equal(url.searchParams.get('staffing'), 'shortage');
  assert.equal(url.searchParams.has('page'), false); assert.equal(query.page, 4);
});
await test('default URL omits empty filters and page one', () => assert.equal(rules.placementHref(parse({ date: '2099-01-27' })), '/admin/placement?date=2099-01-27'));
const many = Array.from({ length: 41 }, (_, i) => ({ ...board[0], id: String(i) }));
await test('pagination has twenty items and stable non-overlapping pages', () => {
  assert.equal(rules.PLACEMENT_PAGE_SIZE, 20);
  const first = rules.paginatePlacement(many, 1); const second = rules.paginatePlacement(many, 2);
  assert.equal(first.pages, 3); assert.equal(first.items.length, 20); assert.equal(second.items.length, 20);
  assert.equal(first.items.at(-1).id, '19'); assert.equal(second.items[0].id, '20');
});
await test('out-of-range and empty pagination clamp safely', () => {
  assert.deepEqual(rules.paginatePlacement([], 99), { page: 1, pages: 1, items: [] });
  assert.equal(rules.paginatePlacement(many, 0).page, 1); assert.equal(rules.paginatePlacement(many, 999).page, 3);
  assert.equal(rules.paginatePlacement(many, 999).items.length, 1);
});
await test('read pagination retains every row under lower server cap', async () => {
  const all = Array.from({ length: 1201 }, (_, id) => ({ id })); let calls = 0;
  const actual = await readAllPages(async (from, to) => { calls++; assert.equal(to - from, 499); return { data: all.slice(from, from + 400), error: null, count: all.length }; });
  assert.deepEqual(actual, all); assert.equal(calls, 4);
});
await test('read pagination errors and incomplete counts do not masquerade as empty', async () => {
  await assert.rejects(readAllPages(async () => ({ data: null, error: new Error('read failed'), count: null })), /read failed/);
  await assert.rejects(readAllPages(async () => ({ data: [], error: null, count: 1 })), /Incomplete/);
});
console.log(`Placement rules: ${count}/${count} passed`);
