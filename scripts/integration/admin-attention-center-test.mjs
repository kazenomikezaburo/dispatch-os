import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAttentionData } from "../../lib/admin/attention/attention-rules.ts";
import { placementCoverageShortages } from "../../lib/admin/placement/placement-editor-rules.ts";

let checks=0;
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks+=1;};
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};
const window={from:"2099-01-01T15:00:00.000Z",to:"2099-01-09T15:00:00.000Z"};
const startsAt="2099-01-02T00:00:00.000Z";
const common={shiftId:"shift-a",projectId:"project-a",projectName:"案件A",workplaceName:"会場A",startsAt};
const sources={
  staffing:[{...common,jobName:"受付",requiredWorkers:3,assignedWorkers:1,staffingState:"shortage"}],
  placement:[{...common,planId:"plan-a",positionId:"position-a",positionLabel:"受付",jobName:"受付",intervalStart:startsAt,intervalEnd:"2099-01-02T01:00:00.000Z",shortage:1,current:true}],
  preConfirmations:[{...common,assignmentId:"assignment-pre",workerName:"佐藤",openAt:"2099-01-01T15:00:00.000Z",state:"pending",beforeStart:true}],
  dayOf:[{...common,assignmentId:"assignment-day",workerName:"田中",startWorkAt:null,state:"start_missing",lateMinutes:0}],
  incidents:[{...common,incidentId:"incident-a",assignmentId:"assignment-sos",workerName:"鈴木",createdAt:"2099-01-01T23:00:00.000Z",state:"open"}],
  attendanceReviews:[{...common,assignmentId:"assignment-review",workerName:"山田",endWorkAt:"2099-01-02T08:00:00.000Z",state:"finished",confirmationState:"unconfirmed"}],
};

const data=buildAttentionData(sources,window);
equal(data.items.map(item=>item.type),["open_sos","day_of_arrival","staffing_shortage","placement_conflict","pre_confirmation_overdue","attendance_needs_review"],"mixed queue has stable severity/type order");
equal(data.summary,{total:6,urgent:1,staffing:2,confirmation:2,dayOf:1},"summary uses the same derived items");
equal(data.items.map(item=>item.id),["open_sos:incident-a","day_of_arrival:assignment-day","staffing_shortage:shift-a","placement_conflict:plan-a:position-a","pre_confirmation_overdue:assignment-pre","attendance_needs_review:assignment-review"],"deterministic identities");
ok(data.items.every(item=>item.destination.startsWith("/admin/")),"all actions use canonical Admin routes");

const resolved=buildAttentionData({
  staffing:[{...sources.staffing[0],assignedWorkers:3,staffingState:"filled"}],
  placement:[{...sources.placement[0],shortage:0}],
  preConfirmations:[{...sources.preConfirmations[0],state:"confirmed"}],
  dayOf:[{...sources.dayOf[0],startWorkAt:startsAt,state:"working",lateMinutes:0}],
  incidents:[{...sources.incidents[0],state:"acknowledged"}],
  attendanceReviews:[{...sources.attendanceReviews[0],confirmationState:"confirmed"}],
},window);
equal(resolved.items,[],"resolving every canonical source condition removes Attention");
equal(resolved.summary.total,0,"resolved summary is empty");
equal(buildAttentionData({...sources,preConfirmations:[{...sources.preConfirmations[0],beforeStart:false}]},window).items.some(item=>item.type==="pre_confirmation_overdue"),false,"pre-confirmation Attention yields to Day-of at Shift start");
equal(buildAttentionData({...sources,dayOf:[{...sources.dayOf[0],startWorkAt:startsAt,state:"finished",lateMinutes:0}]},window).items.some(item=>item.type==="day_of_arrival"),false,"late Attention resolves when the official start is corrected to the planned start");
equal(buildAttentionData({...sources,dayOf:[{...sources.dayOf[0],startWorkAt:"2099-01-02T00:15:00.000Z",state:"finished",lateMinutes:15}]},window).items.some(item=>item.type==="day_of_arrival"),true,"unresolved late Attention remains after work ends until the source is corrected");

const plan={startsAt,endsAt:"2099-01-02T08:00:00.000Z",positions:[{id:"position-a",label:"受付",requiredWorkers:1,displayOrder:0,retired:false}],segments:[],breaks:[],assignments:[]};
const uncovered=placementCoverageShortages(plan);
equal(uncovered.map(item=>({startAt:item.startAt,endAt:item.endAt,shortage:item.shortage})),[{startAt:plan.startsAt,endAt:plan.endsAt,shortage:1}],"Shift bounds expose a wholly uncovered Position");
const covered=placementCoverageShortages({...plan,segments:[{id:"segment-a",assignmentId:"assignment-a",positionId:"position-a",startAt:plan.startsAt,endAt:plan.endsAt}],assignments:[{assignmentId:"assignment-a",status:"assigned",worker:null}]});
equal(covered,[],"restored Position coverage removes the shortage");

const loader=await readFile(new URL("../../lib/admin/attention/get-admin-attention.ts",import.meta.url),"utf8");
const nav=await readFile(new URL("../../components/admin/admin-nav.ts",import.meta.url),"utf8");
ok(loader.includes("ATTENTION_WINDOW_DAYS = 8"),"source reads are time bounded");
ok(loader.includes("ATTENTION_QUEUE_LIMIT = 100"),"mixed queue output is bounded");
assert.doesNotMatch(loader,/service_role|\.insert\(|\.update\(|\.delete\(|\.rpc\(/,"Attention loader has no privileged client or writes");checks+=1;
ok(nav.includes('href: "/admin/attention"'),"Attention Center is reachable from canonical Admin navigation");
ok(checks>=12,"focused suite remains substantive");
console.log(`Admin Attention Center: PASS (${checks} assertions)`);
