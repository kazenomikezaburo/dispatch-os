import assert from "node:assert/strict";
import test from "node:test";
import { parseHistoryPage,parseWorkerListQuery,parseWorkerTab,workerDetailHref,workerListHref } from "../../lib/admin/workers/worker-rules.ts";

test("worker list query normalizes GET state",()=>{assert.deepEqual(parseWorkerListQuery({q:"  TEST Worker  ",status:"active",page:"2"}),{q:"TEST Worker",status:"active",page:2});});
test("worker list query rejects invalid values",()=>{assert.deepEqual(parseWorkerListQuery({status:"blocked",page:"-2"}),{q:"",status:"all",page:1});});
test("worker query is bounded",()=>{assert.equal(parseWorkerListQuery({q:"x".repeat(140)}).q.length,100);});
test("invalid staff tab falls back to overview",()=>{assert.equal(parseWorkerTab("feedback"),"overview");});
test("supported staff tabs remain stable",()=>{assert.equal(parseWorkerTab("history"),"history");assert.equal(parseWorkerTab("profile"),"profile");});
test("history page rejects invalid values",()=>{assert.equal(parseHistoryPage("0"),1);assert.equal(parseHistoryPage("3"),3);});
test("list href preserves canonical GET state",()=>{assert.equal(workerListHref({q:"山田",status:"active",page:2},{page:3}),"/admin/workers?q=%E5%B1%B1%E7%94%B0&status=active&page=3");});
test("detail href omits default tab",()=>{assert.equal(workerDetailHref("worker-id","overview"),"/admin/workers/worker-id");assert.equal(workerDetailHref("worker-id","history",2),"/admin/workers/worker-id?tab=history&historyPage=2");});
