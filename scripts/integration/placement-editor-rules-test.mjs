// Pure editor rule tests. No network, Auth or DB writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import Module, { createRequire } from 'node:module';
const loadTs=createRequire(import.meta.url); const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,...args)};
loadTs.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const rules=loadTs('../../lib/admin/placement/placement-editor-rules.ts'); let count=0;
function test(name,fn){fn();count++;console.log(`PASS ${name}`)}
const base={planId:null,version:0,shiftId:'00000000-0000-4000-8000-000000000001',startsAt:'2026-09-08T13:00:00Z',endsAt:'2026-09-08T21:00:00Z',requiredWorkers:2,breakMinutes:60,correctionRequired:false,positions:[],segments:[],breaks:[],assignments:[{assignmentId:'a',status:'assigned',worker:{id:'w',name:'A',staffCode:'1'}}]};
test('overnight resolves next-day time',()=>assert.equal(rules.resolveShiftTime('01:00',base),'2026-09-08T16:00:00.000Z'));
test('outside overnight range rejects',()=>assert.equal(rules.resolveShiftTime('08:00',base),null));
test('invalid time rejects',()=>assert.equal(rules.resolveShiftTime('25:00',base),null));
test('adjacent segments are valid',()=>{const plan={...base,positions:[{id:'p',label:'受付',requiredWorkers:1,displayOrder:0,retired:false}],segments:[{id:'s1',assignmentId:'a',positionId:'p',startAt:'2026-09-08T13:00:00Z',endAt:'2026-09-08T14:00:00Z'},{id:'s2',assignmentId:'a',positionId:'p',startAt:'2026-09-08T14:00:00Z',endAt:'2026-09-08T15:00:00Z'}]};assert.deepEqual(rules.validatePlacementDraft(plan),[])});
test('segment overlap is rejected',()=>{const plan={...base,positions:[{id:'p',label:'受付',requiredWorkers:1,displayOrder:0,retired:false}],segments:[{id:'s1',assignmentId:'a',positionId:'p',startAt:'2026-09-08T13:00:00Z',endAt:'2026-09-08T15:00:00Z'},{id:'s2',assignmentId:'a',positionId:'p',startAt:'2026-09-08T14:00:00Z',endAt:'2026-09-08T16:00:00Z'}]};assert.match(rules.validatePlacementDraft(plan)[0],/配置時間/)});
test('break overlap with placement is rejected',()=>{const plan={...base,positions:[{id:'p',label:'受付',requiredWorkers:1,displayOrder:0,retired:false}],segments:[{id:'s',assignmentId:'a',positionId:'p',startAt:'2026-09-08T13:00:00Z',endAt:'2026-09-08T15:00:00Z'}],breaks:[{id:'b',assignmentId:'a',startAt:'2026-09-08T14:00:00Z',endAt:'2026-09-08T14:30:00Z'}]};assert.match(rules.validatePlacementDraft(plan)[0],/配置と休憩/)});
test('requirement exceeded blocks save',()=>{const plan={...base,positions:[{id:'p',label:'受付',requiredWorkers:3,displayOrder:0,retired:false}]};assert.match(rules.validatePlacementDraft(plan)[0],/超えて/)});
test('partial requirement is valid',()=>{const plan={...base,positions:[{id:'p',label:'受付',requiredWorkers:1,displayOrder:0,retired:false}]};assert.deepEqual(rules.validatePlacementDraft(plan),[])});
test('coverage subtracts break at exact boundaries',()=>{const p={id:'p',label:'受付',requiredWorkers:1,displayOrder:0,retired:false};const s=[{id:'s',assignmentId:'a',positionId:'p',startAt:'2026-09-08T13:00:00Z',endAt:'2026-09-08T15:00:00Z'}];const b=[{id:'b',assignmentId:'a',startAt:'2026-09-08T14:00:00Z',endAt:'2026-09-08T14:30:00Z'}];assert.deepEqual(rules.positionCoverage(p,s,b).map(x=>x.shortage),[0,1,0])});
test('unknown requirement yields unknown shortage',()=>{const p={id:'p',label:'受付',requiredWorkers:null,displayOrder:0,retired:false};assert.equal(rules.positionCoverage(p,[],[]).length,0)});
test('duration sum supports multiple breaks',()=>assert.equal(rules.plannedMinutes([{startAt:'2026-09-08T13:00:00Z',endAt:'2026-09-08T13:15:00Z'},{startAt:'2026-09-08T14:00:00Z',endAt:'2026-09-08T14:45:00Z'}]),60));
test('timeline geometry preserves real relative duration',()=>{assert.equal(rules.timelineGeometry(base.startsAt,base.startsAt,base.endsAt),0);assert.equal(rules.timelineGeometry('2026-09-08T17:00:00Z',base.startsAt,base.endsAt),50);assert.equal(rules.timelineGeometry(base.endsAt,base.startsAt,base.endsAt),100)});
test('overnight markers identify the next day',()=>{const markers=rules.timelineMarkers(base.startsAt,base.endsAt);assert.equal(markers[0].label,'22:00');assert.ok(markers.some(marker=>marker.label==='翌 00:00'));assert.equal(markers.at(-1).label,'翌 06:00')});
console.log(`Placement editor rules: ${count}/${count} passed`);
