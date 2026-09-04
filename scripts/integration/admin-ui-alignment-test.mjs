// Pure UI-state/schema regression tests. No network, auth, fixtures or database writes.
// Uses the project's existing TypeScript compiler to resolve extensionless TS imports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const loadTs = createRequire(import.meta.url);
loadTs.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
const { initialShiftDates, addShiftDates } = loadTs('../../lib/admin/projects/shift-create-editor-state.ts');
const { generateDates, normalizeOverride, resolveShiftConfig, isValidDateOnly } = loadTs('../../lib/admin/projects/bulk-shift-helpers.ts');
const { bulkShiftFormSchema } = loadTs('../../lib/admin/projects/bulk-shift-form-schema.ts');
const { adminNavigationGroups, visibleAdminNavigationGroups, isAdminNavItemActive: isAdminNavActive } = loadTs('../../components/admin/admin-nav.ts');
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
const base = { startTime: '09:00', endTime: '18:00', endsNextDay: false, requiredWorkers: '2', breakMinutes: '60', deadlineEnabled: false, deadlineDaysBefore: '2', deadlineTime: '18:00', status: 'recruiting' };
const row = { date: '2099-01-20', ...base };
test('initial single date', () => assert.deepEqual(initialShiftDates(row.date), [row.date]));
test('invalid initial date', () => assert.deepEqual(initialShiftDates('2099-13-01'), []));
test('invalid month does not throw', () => assert.equal(isValidDateOnly('2099-13-01'), false));
test('invalid day rejected', () => assert.equal(isValidDateOnly('2099-02-30'), false));
test('merge sorted unique dates', () => assert.deepEqual(addShiftDates(['2099-01-22'], ['2099-01-20', '2099-01-22', 'bad']), ['2099-01-20', '2099-01-22']));
test('date generation merges without losing existing dates', () => assert.deepEqual(addShiftDates(['2099-01-01'], generateDates('2099-01-20', '2099-01-21', [0,1,2,3,4,5,6])), ['2099-01-01','2099-01-20','2099-01-21']));
const diff = normalizeOverride(base, { ...base, requiredWorkers: '3' });
test('override contains only changed fields', () => assert.deepEqual(diff, {requiredWorkers:'3'}));
test('common changes preserve override', () => assert.equal(resolveShiftConfig({...base, requiredWorkers:'4'}, diff).requiredWorkers, '3'));
test('non-overridden fields inherit common changes', () => assert.equal(resolveShiftConfig({...base, startTime:'10:00'}, diff).startTime, '10:00'));
test('reset removes override', () => assert.deepEqual(normalizeOverride(base, base), {}));
test('single accepted by existing bulk contract', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[row]}).success, true));
test('multiple accepted', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[row,{...row,date:'2099-01-21'}]}).success, true));
test('zero dates rejected', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[]}).success, false));
test('duplicate dates rejected', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[row,row]}).success, false));
test('zero required workers rejected', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[{...row,requiredWorkers:'0'}]}).success, false));
test('reverse time rejected', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[{...row,endTime:'08:00'}]}).success, false));
test('overnight accepted', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[{...row,endTime:'08:00',endsNextDay:true}]}).success, true));
test('excess break rejected', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[{...row,breakMinutes:'999'}]}).success, false));
test('late deadline rejected', () => assert.equal(bulkShiftFormSchema.safeParse({shifts:[{...row,deadlineEnabled:true,deadlineDaysBefore:'0',deadlineTime:'10:00'}]}).success, false));
test('deep route active', () => assert.equal(isAdminNavActive('/admin/projects/a/jobs/b/shifts/new', '/admin/projects'), true));
test('home not active for deep route', () => assert.equal(isAdminNavActive('/admin/projects', '/admin'), false));
test('no href never active', () => assert.equal(isAdminNavActive('/admin/projects', undefined), false));
test('future navigation hidden', () => assert.equal(visibleAdminNavigationGroups.flatMap(g=>g.items).some(i=>i.availability==='future'), false));
test('future has no route', () => assert.equal(adminNavigationGroups.flatMap(g=>g.items).some(i=>i.availability==='future' && i.href), false));
console.log(`Admin UI alignment: ${count}/${count} passed`);
