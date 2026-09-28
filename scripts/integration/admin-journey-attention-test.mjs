import assert from "node:assert/strict";
import { buildAttentionData } from "../../lib/admin/attention/attention-rules.ts";
import { buildDayOfItems } from "../../lib/admin/day-of/day-of-rules.ts";
import { deriveJourneyState } from "../../lib/worker/journey/worker-journey.ts";

let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

const emptyFact = { operation: null, occurredAt: null, timeliness: null };
const baseFacts = {
  assignmentId: "assignment-a", shiftId: "shift-a", generatedAt: "2099-01-01T09:16:00.000Z",
  assignmentStatus: "confirmed", shiftStatus: "scheduled", startsAt: "2099-01-01T12:00:00.000Z",
  endsAt: "2099-01-01T20:00:00.000Z", arrivalTarget: "2099-01-01T11:00:00.000Z",
  hasConfirmation: true, confirmationSubmittedAt: "2098-12-31T00:00:00.000Z",
  plannedWakeAt: "2099-01-01T09:00:00.000Z", plannedDepartureAt: "2099-01-01T10:00:00.000Z",
  wake: emptyFact, departure: emptyFact, arrival: emptyFact, startWorkAt: null, endWorkAt: null,
  placementLabels: [],
};

equal(deriveJourneyState({...baseFacts,generatedAt:"2099-01-01T09:14:59.000Z"},"wake").state,"actionable","Wake is not overdue before the frozen 15 minute grace");
equal(deriveJourneyState(baseFacts,"wake").state,"overdue","Wake becomes overdue after the frozen grace");
equal(deriveJourneyState({...baseFacts,generatedAt:"2099-01-01T10:09:59.000Z"},"departure").state,"actionable","Departure is not overdue before 10 minutes");
equal(deriveJourneyState({...baseFacts,generatedAt:"2099-01-01T10:10:00.000Z"},"departure").state,"overdue","Departure becomes overdue at 10 minutes");
equal(deriveJourneyState({...baseFacts,generatedAt:"2099-01-01T11:05:00.000Z"},"arrival").state,"overdue","Arrival becomes overdue at 5 minutes");
equal(deriveJourneyState({...baseFacts,plannedWakeAt:null},"wake").state,"not_required","Missing Wake plan never creates Attention");
equal(deriveJourneyState({...baseFacts,wake:{operation:"recorded",occurredAt:"2099-01-01T09:20:00.000Z",timeliness:"late"}},"wake").state,"completed_late","Recorded Wake self-resolves the missing fact");
equal(deriveJourneyState({...baseFacts,arrival:{operation:"recorded",occurredAt:"2099-01-01T11:01:00.000Z",timeliness:"late"}},"departure").state,"missing_superseded","Arrival supersedes missing Departure");
equal(deriveJourneyState({...baseFacts,startWorkAt:"2099-01-01T11:06:00.000Z"},"arrival").state,"missing_superseded","Attendance start closes missing Arrival without creating Arrival");
equal(deriveJourneyState({...baseFacts,assignmentStatus:"cancelled_by_company"},"wake").state,"closed","Terminal Assignment closes journey Attention");
equal(deriveJourneyState({...baseFacts,shiftStatus:"cancelled"},"arrival").state,"closed","Cancelled Shift closes journey Attention");

const commonJourney = {
  assignmentId:"assignment-a",shiftId:"shift-a",workerId:"worker-a",workerName:"田中 花子",staffCode:"W-001",
  projectId:"project-a",projectName:"案件A",jobId:"job-a",jobName:"受付",workplaceName:"会場A",
  startsAt:baseFacts.startsAt,arrivalTarget:baseFacts.arrivalTarget,generatedAt:"2099-01-01T11:06:00.000Z",
};
const journeys = [
  {...commonJourney,type:"wake_overdue",targetAt:baseFacts.plannedWakeAt,overdueMinutes:126},
  {...commonJourney,type:"departure_overdue",targetAt:baseFacts.plannedDepartureAt,overdueMinutes:66},
  {...commonJourney,type:"arrival_overdue",targetAt:baseFacts.arrivalTarget,overdueMinutes:6},
];
const attention = buildAttentionData({staffing:[],placement:[],preConfirmations:[],journeys,dayOf:[],incidents:[],attendanceReviews:[]},{from:"2099-01-01T00:00:00Z",to:"2099-01-02T00:00:00Z"});
equal(attention.items.map(item=>item.type),["arrival_overdue","departure_overdue","wake_overdue"],"Distinct journey exceptions sort by urgency");
equal(new Set(attention.items.map(item=>item.id)).size,3,"Each assignment/type has a deterministic distinct identity");
equal(attention.items.map(item=>item.severity),["critical","critical","high"],"Arrival and Departure past arrival target escalate to critical");
equal(attention.summary.dayOf,3,"Journey exceptions are counted as Day-of Attention");
const coexist=buildAttentionData({staffing:[],placement:[],preConfirmations:[],journeys:[...journeys,{...commonJourney,assignmentId:"assignment-b",type:"arrival_overdue",targetAt:baseFacts.arrivalTarget,overdueMinutes:7}],dayOf:[],incidents:[{shiftId:"shift-a",projectId:"project-a",projectName:"案件A",workplaceName:"会場A",startsAt:baseFacts.startsAt,incidentId:"incident-a",assignmentId:"assignment-a",workerName:"田中 花子",createdAt:"2099-01-01T11:01:00.000Z",state:"open"}],attendanceReviews:[]},{from:"2099-01-01T00:00:00Z",to:"2099-01-02T00:00:00Z"});
equal(coexist.items[0].type,"open_sos","Independent Incident Attention retains highest priority");
equal(coexist.items.filter(item=>item.type==="arrival_overdue").map(item=>item.assignmentId),["assignment-a","assignment-b"],"Multiple Assignments remain deterministic without same assignment/type duplicates");

const dayOfBase = {
  assignmentId:"assignment-a",assignmentStatus:"confirmed",workerId:"worker-a",workerName:"田中 花子",staffCode:"W-001",
  shiftId:"shift-a",startsAt:baseFacts.startsAt,endsAt:baseFacts.endsAt,requiredWorkers:1,projectId:"project-a",projectName:"案件A",
  jobId:"job-a",jobName:"受付",workplaceName:"会場A",startWorkAt:null,endWorkAt:null,preShift:{canWork:true,submittedAt:"2098-12-31T00:00:00Z"},
  placements:[],breaks:[],attendanceConfirmed:false,incidentAttention:null,journeyAttention:journeys,
};
const query={date:"2099-01-01",q:"",project:"",shift:"",state:"attention",assignment:""};
const dayOf=buildDayOfItems([dayOfBase],query,new Date("2099-01-01T11:06:00.000Z"));
equal(dayOf.length,1,"Journey exception includes the Assignment in the Day-of attention filter");
equal(dayOf[0].attentionReason,"到着 6分超過 / 出発 66分超過 / 起床 126分超過","Day-of shows canonical journey cues in operational priority order");

console.log(`Admin journey Attention: PASS (${checks} assertions)`);
