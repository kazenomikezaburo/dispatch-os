import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';

const dockerArgs = ['exec', '-i', 'supabase_db_dispatch-os', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'];
const shiftA = '20000000-0000-0000-0000-000000000001';
const shiftB = '20000000-0000-0000-0000-000000000003';
const assignmentA = '40000000-0000-0000-0000-000000000002';
const assignmentB = '40000000-0000-0000-0000-000000000003';
const manager = 'a0000000-0000-0000-0000-000000000004';
const systemAdmin = 'a0000000-0000-0000-0000-000000000005';
const worker = 'a0000000-0000-0000-0000-000000000001';

function sqlLiteral(value) {
  return `$$${JSON.stringify(value)}$$::jsonb`;
}

function textLiteral(value) {
  return value === null ? 'null' : `'${value.replaceAll("'", "''")}'`;
}

function run(sql, { allowFailure = false } = {}) {
  try {
    return execFileSync('docker', dockerArgs, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFailure) return `${error.stdout ?? ''}${error.stderr ?? ''}`;
    throw error;
  }
}

function roleSql(profileId, body) {
  return `begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"${profileId}","role":"authenticated"}';
${body}
commit;`;
}

function callSql(profileId, shiftId, expectedVersion, key, payload, reason = null) {
  return roleSql(profileId, `select public.save_shift_placement_plan(
  '${shiftId}'::uuid,
  ${expectedVersion},
  ${textLiteral(key)},
  ${textLiteral(reason)},
  ${sqlLiteral(payload.positions)},
  ${sqlLiteral(payload.segments)},
  ${sqlLiteral(payload.breaks)}
)::text;`);
}

function call(profileId, shiftId, expectedVersion, key, payload, reason = null) {
  const output = run(callSql(profileId, shiftId, expectedVersion, key, payload, reason));
  return JSON.parse(output.split(/\r?\n/).at(-1));
}

function concurrentCall(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)));
      else reject(new Error(stderr || stdout));
    });
    child.stdin.end(sql);
  });
}

const basePayload = {
  positions: [{ id: '93000000-0000-0000-0000-000000000001', label: '受付', required_workers: 1, display_order: 0 }],
  segments: [{ id: '94000000-0000-0000-0000-000000000001', assignment_id: assignmentA, position_id: '93000000-0000-0000-0000-000000000001', start_at: '2099-01-15T00:00:00Z', end_at: '2099-01-15T03:00:00Z' }],
  breaks: [{ id: '95000000-0000-0000-0000-000000000001', assignment_id: assignmentA, start_at: '2099-01-15T03:00:00Z', end_at: '2099-01-15T03:30:00Z' }, { id: '95000000-0000-0000-0000-000000000002', assignment_id: assignmentA, start_at: '2099-01-15T03:30:00Z', end_at: '2099-01-15T04:00:00Z' }],
};

const editedPayload = {
  ...basePayload,
  positions: [{ ...basePayload.positions[0], required_workers: 2 }],
};

function cleanup() {
  run(`begin;
delete from public.shift_placement_plan_revisions where shift_slot_id in ('${shiftA}'::uuid, '${shiftB}'::uuid);
delete from public.assignment_placement_segments where shift_slot_id in ('${shiftA}'::uuid, '${shiftB}'::uuid);
delete from public.assignment_break_intervals where shift_slot_id in ('${shiftA}'::uuid, '${shiftB}'::uuid);
delete from public.shift_positions where plan_id in (select id from public.shift_placement_plans where shift_slot_id in ('${shiftA}'::uuid, '${shiftB}'::uuid));
delete from public.shift_placement_plans where shift_slot_id in ('${shiftA}'::uuid, '${shiftB}'::uuid);
commit;`);
}

let count = 0;
function pass(name, value) {
  assert.ok(value, name);
  count += 1;
  console.log(`PASS ${name}`);
}

try {
  const preflight = run(`select count(*)::text from public.shift_placement_plans where shift_slot_id in ('${shiftA}'::uuid, '${shiftB}'::uuid);`);
  assert.equal(preflight, '0', 'C2 fixtures must start without Plans');

  const first = call(manager, shiftA, 0, 'c2-first', basePayload);
  pass('first save creates Plan at version 1', first.ok && first.version === 1 && first.replayed === false);
  pass('first save writes one Revision', run(`select count(*)::text from public.shift_placement_plan_revisions where shift_slot_id='${shiftA}'::uuid;`) === '1');

  const replay = call(manager, shiftA, 0, 'c2-first', basePayload);
  pass('idempotent replay returns original version without a new Revision', replay.ok && replay.replayed && replay.version === 1 && run(`select count(*)::text from public.shift_placement_plan_revisions where shift_slot_id='${shiftA}'::uuid;`) === '1');

  const idempotencyConflict = call(manager, shiftA, 1, 'c2-first', editedPayload);
  pass('same idempotency key with a different request is rejected', !idempotencyConflict.ok && idempotencyConflict.code === 'IDEMPOTENCY_CONFLICT');

  const updated = call(manager, shiftA, 1, 'c2-update', editedPayload);
  pass('current expected version advances Plan and Revision', updated.ok && updated.version === 2 && run(`select count(*)::text from public.shift_placement_plan_revisions where shift_slot_id='${shiftA}'::uuid;`) === '2');
  const stale = call(manager, shiftA, 1, 'c2-stale', editedPayload);
  pass('stale expected version returns conflict with zero mutation', !stale.ok && stale.code === 'VERSION_CONFLICT' && stale.current_version === 2 && run(`select count(*)::text from public.shift_placement_plan_revisions where shift_slot_id='${shiftA}'::uuid;`) === '2');

  const overflow = { ...editedPayload, positions: [{ ...editedPayload.positions[0], required_workers: 4 }] };
  const overflowResult = run(callSql(manager, shiftA, 2, 'c2-overflow', overflow), { allowFailure: true });
  pass('Position requirement sum above Shift requirement is rejected', overflowResult.includes('REQUIREMENT_EXCEEDED'));

  const badOverlap = { ...editedPayload, breaks: [{ id: '95000000-0000-0000-0000-000000000003', assignment_id: assignmentA, start_at: '2099-01-15T02:00:00Z', end_at: '2099-01-15T03:30:00Z' }] };
  const beforeAtomic = run(`select json_build_object('positions', (select count(*) from public.shift_positions where plan_id='${first.plan_id}'::uuid), 'segments', (select count(*) from public.assignment_placement_segments where plan_id='${first.plan_id}'::uuid), 'breaks', (select count(*) from public.assignment_break_intervals where plan_id='${first.plan_id}'::uuid), 'revisions', (select count(*) from public.shift_placement_plan_revisions where plan_id='${first.plan_id}'::uuid), 'version', (select version from public.shift_placement_plans where id='${first.plan_id}'::uuid))::text;`);
  const overlapResult = run(callSql(manager, shiftA, 2, 'c2-overlap', badOverlap), { allowFailure: true });
  const afterAtomic = run(`select json_build_object('positions', (select count(*) from public.shift_positions where plan_id='${first.plan_id}'::uuid), 'segments', (select count(*) from public.assignment_placement_segments where plan_id='${first.plan_id}'::uuid), 'breaks', (select count(*) from public.assignment_break_intervals where plan_id='${first.plan_id}'::uuid), 'revisions', (select count(*) from public.shift_placement_plan_revisions where plan_id='${first.plan_id}'::uuid), 'version', (select version from public.shift_placement_plans where id='${first.plan_id}'::uuid))::text;`);
  pass('Segment versus Break overlap rejects atomically', overlapResult.includes('OVERLAP') && beforeAtomic === afterAtomic);

  const beforeRange = { ...editedPayload, segments: [{ ...editedPayload.segments[0], start_at: '2099-01-14T23:59:59Z' }] };
  pass('Segment outside Shift range is rejected', run(callSql(manager, shiftA, 2, 'c2-segment-range', beforeRange), { allowFailure: true }).includes('INVALID_TIME_RANGE'));
  const breakRange = { ...editedPayload, breaks: [{ ...editedPayload.breaks[0], start_at: '2099-01-15T08:30:00Z', end_at: '2099-01-15T09:01:00Z' }] };
  pass('Break outside Shift range is rejected', run(callSql(manager, shiftA, 2, 'c2-break-range', breakRange), { allowFailure: true }).includes('INVALID_TIME_RANGE'));

  const crossBranch = run(callSql(manager, shiftB, 0, 'c2-foreign', { positions: [], segments: [], breaks: [] }), { allowFailure: true });
  pass('Manager cannot save a foreign-branch Plan', crossBranch.includes('FORBIDDEN'));
  const workerResult = run(callSql(worker, shiftA, 2, 'c2-worker', editedPayload), { allowFailure: true });
  pass('Worker cannot execute Placement save', workerResult.includes('FORBIDDEN'));
  const admin = call(systemAdmin, shiftB, 0, 'c2-admin', { positions: [], segments: [], breaks: [] });
  pass('System Admin can save a cross-branch Plan', admin.ok && admin.version === 1);

  const [concurrentA, concurrentB] = await Promise.all([
    concurrentCall(callSql(manager, shiftA, 2, 'c2-concurrent-a', editedPayload)),
    concurrentCall(callSql(manager, shiftA, 2, 'c2-concurrent-b', editedPayload)),
  ]);
  pass('concurrent expected-version saves yield exactly one success', [concurrentA, concurrentB].filter((result) => result.ok).length === 1 && [concurrentA, concurrentB].filter((result) => result.code === 'VERSION_CONFLICT').length === 1);
  pass('concurrent success advances version exactly once', run(`select version::text from public.shift_placement_plans where id='${first.plan_id}'::uuid;`) === '3');

  const direct = run(`select bool_and(not has_table_privilege('authenticated', relation, 'INSERT') and not has_table_privilege('authenticated', relation, 'UPDATE') and not has_table_privilege('authenticated', relation, 'DELETE'))::text from unnest(array['public.shift_placement_plans','public.shift_positions','public.assignment_placement_segments','public.assignment_break_intervals','public.shift_placement_plan_revisions']) as relations(relation);`);
  pass('authenticated direct DML remains denied on every Placement table', direct === 'true');
  const grants = run(`select (has_function_privilege('authenticated','public.save_shift_placement_plan(uuid,bigint,text,text,jsonb,jsonb,jsonb)','EXECUTE') and not has_function_privilege('anon','public.save_shift_placement_plan(uuid,bigint,text,text,jsonb,jsonb,jsonb)','EXECUTE'))::text;`);
  pass('RPC execute is authenticated-only', grants === 'true');

  const revision = run(`select (count(*) = 3 and bool_and(actor_profile_id='${manager}'::uuid) and bool_and(version_to=version_from+1) and bool_and(jsonb_typeof(before_snapshot)='object' and jsonb_typeof(after_snapshot)='object'))::text from public.shift_placement_plan_revisions where shift_slot_id='${shiftA}'::uuid;`);
  pass('Revision stores derived actor, adjacent versions and graph snapshots', revision === 'true');

  const directBreakOverlap = run(`insert into public.assignment_break_intervals (id, plan_id, shift_slot_id, assignment_id, start_at, end_at) values ('95000000-0000-0000-0000-000000000099'::uuid, '${first.plan_id}'::uuid, '${shiftA}'::uuid, '${assignmentA}'::uuid, '2099-01-15T03:15:00Z'::timestamptz, '2099-01-15T03:45:00Z'::timestamptz);`, { allowFailure: true });
  pass('DB rejects an overlapping Break on the same Assignment', directBreakOverlap.includes('assignment_break_intervals_assignment_time_excl'));
  const crossShiftBreak = run(`insert into public.assignment_break_intervals (id, plan_id, shift_slot_id, assignment_id, start_at, end_at) values ('95000000-0000-0000-0000-000000000098'::uuid, '${first.plan_id}'::uuid, '${shiftA}'::uuid, '${assignmentB}'::uuid, '2099-01-15T05:00:00Z'::timestamptz, '2099-01-15T05:15:00Z'::timestamptz);`, { allowFailure: true });
  pass('DB rejects a Break whose Assignment belongs to another Shift', crossShiftBreak.includes('assignment_break_intervals_assignment_shift_fkey'));
} finally {
  cleanup();
}

console.log(`Placement Break atomic command: ${count}/${count} passed`);
