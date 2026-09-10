import { execFileSync } from "node:child_process";

const dockerArgs = ["exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"];
const ids = {
  workerProfile: "a0000000-0000-0000-0000-000000000001",
  managerProfile: "a0000000-0000-0000-0000-000000000004",
  worker: "c0000000-0000-0000-0000-000000000001",
  job: "10000000-0000-0000-0000-000000000001",
  shift: "98100000-0000-4000-8001-000000000001",
  assignment: "98100000-0000-4000-8002-000000000001",
  incident: "98100000-0000-4000-8003-000000000001",
  createdEvent: "98100000-0000-4000-8004-000000000001",
  acknowledgedEvent: "98100000-0000-4000-8004-000000000002",
  unavailableNotification: "98100000-0000-4000-8005-000000000001",
  availableNotification: "98100000-0000-4000-8005-000000000002",
};

function run(sql) {
  return execFileSync("docker", dockerArgs, { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function cleanup() {
  run(`begin;
delete from private.incident_notification_projection_receipts where notification_id in ('${ids.availableNotification}','${ids.unavailableNotification}');
delete from public.in_app_notifications where id in ('${ids.availableNotification}','${ids.unavailableNotification}');
delete from public.operational_incident_events where incident_id='${ids.incident}';
delete from public.operational_incidents where id='${ids.incident}';
delete from public.assignments where id='${ids.assignment}';
delete from public.shift_slots where id='${ids.shift}';
commit;`);
}

if (process.argv.includes("--cleanup")) {
  cleanup();
  console.log("Worker Notification fixtures cleaned.");
  process.exit(0);
}

cleanup();
run(`begin;
insert into public.shift_slots (id,job_id,label,starts_at,ends_at,required_workers,status)
values ('${ids.shift}','${ids.job}','Notification QA',now()+interval '2 days',now()+interval '2 days 8 hours',1,'confirmed');
insert into public.assignments (id,shift_slot_id,worker_id,source,status,assigned_by)
values ('${ids.assignment}','${ids.shift}','${ids.worker}','manager','assigned','${ids.managerProfile}');
insert into public.operational_incidents (id,assignment_id,category,message,state,version,created_at,acknowledged_at,updated_at)
values ('${ids.incident}','${ids.assignment}','site_access','Notification UI fixture','acknowledged',2,now()-interval '10 minutes',now()-interval '8 minutes',now()-interval '8 minutes');
insert into public.operational_incident_events (id,incident_id,event_type,actor_profile_id,version_from,version_to,idempotency_key,request_snapshot,created_at)
values
('${ids.createdEvent}','${ids.incident}','created','${ids.workerProfile}',0,1,'ui-28d-created','{}',now()-interval '10 minutes'),
('${ids.acknowledgedEvent}','${ids.incident}','acknowledged','${ids.managerProfile}',1,2,'ui-28d-acknowledged','{}',now()-interval '8 minutes');
insert into public.in_app_notifications (id,recipient_profile_id,notification_type,source_incident_event_id,title,summary,created_at)
values
('${ids.availableNotification}','${ids.workerProfile}','incident_acknowledged','${ids.acknowledgedEvent}','Help Requestへの対応が開始されました','管理者がHelp Requestを確認し、対応を開始しました。',now()-interval '7 minutes'),
('${ids.unavailableNotification}','${ids.workerProfile}','incident_acknowledged','${ids.createdEvent}','勤務情報を確認してください','関連情報の更新を確認してください。',now()-interval '5 minutes');
commit;`);
console.log(JSON.stringify({ assignmentId: ids.assignment, availableNotificationId: ids.availableNotification, unavailableNotificationId: ids.unavailableNotification }));

