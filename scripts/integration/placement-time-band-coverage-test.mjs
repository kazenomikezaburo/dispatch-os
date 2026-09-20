// Pure OPS-1D coverage tests. No network, Auth or DB writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import Module, { createRequire } from 'node:module';

const loadTs = createRequire(import.meta.url);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, ...args); };
loadTs.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const rules = loadTs('../../lib/admin/placement/placement-editor-rules.ts');

let count = 0;
function test(name, fn) { fn(); count += 1; console.log(`PASS ${name}`); }
const position = { id: 'position-1', label: '受付', requiredWorkers: 1, displayOrder: 0, retired: false };
const assignment = (assignmentId) => ({ assignmentId, status: 'assigned', worker: { id: `worker-${assignmentId}`, name: assignmentId, staffCode: assignmentId } });
const segment = (id, assignmentId, startAt, endAt) => ({ id, assignmentId, positionId: position.id, startAt, endAt });
const breakInterval = (id, assignmentId, startAt, endAt) => ({ id, assignmentId, startAt, endAt });
const base = {
  startsAt: '2026-09-20T00:00:00Z',
  endsAt: '2026-09-20T04:00:00Z',
  positions: [position],
  assignments: [assignment('a')],
  segments: [],
  breaks: [],
};

test('fully covered Shift is one bounded band', () => {
  const bands = rules.placementCoverageBands({ ...base, segments: [segment('s', 'a', base.startsAt, base.endsAt)] });
  assert.deepEqual(bands.map(({ startAt, endAt, required, covered, shortage }) => ({ startAt, endAt, required, covered, shortage })), [
    { startAt: base.startsAt, endAt: base.endsAt, required: 1, covered: 1, shortage: 0 },
  ]);
});

test('partially uncovered interval remains visible through Shift end', () => {
  const bands = rules.placementCoverageBands({ ...base, segments: [segment('s', 'a', base.startsAt, '2026-09-20T02:00:00Z')] });
  assert.deepEqual(bands.map((band) => [band.startAt, band.endAt, band.covered, band.shortage]), [
    [base.startsAt, '2026-09-20T02:00:00Z', 1, 0],
    ['2026-09-20T02:00:00Z', base.endsAt, 0, 1],
  ]);
});

test('break creates a coverage gap', () => {
  const bands = rules.placementCoverageBands({ ...base, segments: [segment('s', 'a', base.startsAt, base.endsAt)], breaks: [breakInterval('b', 'a', '2026-09-20T01:00:00Z', '2026-09-20T01:30:00Z')] });
  assert.deepEqual(bands.map((band) => [band.startAt, band.endAt, band.covered, band.shortage]), [
    [base.startsAt, '2026-09-20T01:00:00Z', 1, 0],
    ['2026-09-20T01:00:00Z', '2026-09-20T01:30:00Z', 0, 1],
    ['2026-09-20T01:30:00Z', base.endsAt, 1, 0],
  ]);
});

test('overlapping assignments count unique workers', () => {
  const requiredTwo = { ...position, requiredWorkers: 2 };
  const plan = { ...base, positions: [requiredTwo], assignments: [assignment('a'), assignment('b')], segments: [segment('a-segment', 'a', base.startsAt, base.endsAt), segment('b-segment', 'b', '2026-09-20T01:00:00Z', '2026-09-20T03:00:00Z')] };
  assert.deepEqual(rules.placementCoverageBands(plan).map((band) => [band.startAt, band.endAt, band.covered, band.shortage]), [
    [base.startsAt, '2026-09-20T01:00:00Z', 1, 1],
    ['2026-09-20T01:00:00Z', '2026-09-20T03:00:00Z', 2, 0],
    ['2026-09-20T03:00:00Z', base.endsAt, 1, 1],
  ]);
});

test('coverage is clamped to Shift boundaries', () => {
  const bands = rules.placementCoverageBands({ ...base, segments: [segment('s', 'a', '2026-09-19T23:00:00Z', '2026-09-20T05:00:00Z')], breaks: [breakInterval('outside', 'a', '2026-09-20T05:00:00Z', '2026-09-20T06:00:00Z')] });
  assert.deepEqual(bands.map((band) => [band.startAt, band.endAt]), [[base.startsAt, base.endsAt]]);
});

test('Attention shortages are the exact shared band filter', () => {
  const plan = { ...base, segments: [segment('s', 'a', base.startsAt, '2026-09-20T02:00:00Z')] };
  assert.deepEqual(rules.placementCoverageShortages(plan), rules.placementCoverageBands(plan).filter((band) => band.shortage > 0));
});

test('inactive assignment data does not contribute coverage', () => {
  const plan = { ...base, segments: [segment('stale', 'removed', base.startsAt, base.endsAt)] };
  assert.equal(rules.placementCoverageBands(plan)[0].covered, 0);
});

const component = fs.readFileSync(path.resolve('components/admin/placement/time-band-coverage.tsx'), 'utf8');
const surface = fs.readFileSync(path.resolve('components/admin/placement/shift-placement-surface.tsx'), 'utf8');
test('Placement renders the shared coverage bands with required covered and shortage values', () => {
  assert.match(component, /placementCoverageBands\(plan\)/);
  assert.match(component, /必要/);
  assert.match(component, /Coverage/);
  assert.match(component, /不足/);
  assert.match(surface, /<TimeBandCoverage plan=\{plan\}/);
});

console.log(`OPS-1D time-band coverage: ${count}/${count} passed`);
