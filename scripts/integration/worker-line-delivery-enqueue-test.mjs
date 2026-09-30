import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const sql = String.raw`
begin;
set constraints all deferred;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $body$
begin
  if not coalesce(p_value, false) then raise exception '%', p_message; end if;
end;
$body$;

create function pg_temp.insert_reminder(
  p_notification_id uuid,
  p_assignment_id uuid,
  p_profile_id uuid,
  p_type text,
  p_phase text,
  p_created_at timestamptz
) returns void language plpgsql as $body$
declare v_occurrence_id uuid := gen_random_uuid();
begin
  insert into private.scheduled_worker_reminder_occurrences(
    id,assignment_id,recipient_profile_id,reminder_type,phase,eligible_at,due_at,
    notification_id,created_at
  ) values (
    v_occurrence_id,p_assignment_id,p_profile_id,p_type,p_phase,p_created_at,p_created_at,
    p_notification_id,p_created_at
  );
  insert into public.in_app_notifications(
    id,recipient_profile_id,notification_type,source_incident_event_id,source_announcement_id,
    source_pre_confirmation_reminder_id,source_scheduled_worker_reminder_id,title,summary,created_at
  ) values (
    p_notification_id,p_profile_id,p_type,null,null,null,v_occurrence_id,
    'C2 enqueue test','Controlled reminder summary',p_created_at
  );
end;
$body$;

do $body$
declare
  v_profile uuid := 'a0000000-0000-0000-0000-000000000001';
  v_now timestamptz := clock_timestamp();
  v_delivery uuid;
  v_start uuid;
begin
  update public.profiles set is_active=true,account_type='worker' where id=v_profile;
  update public.workers set status='active' where auth_profile_id=v_profile;
  delete from private.worker_line_links where profile_id=v_profile;
  insert into private.worker_line_links(
    profile_id,line_user_id,destination_status,external_reminders_enabled,enabled_at,
    linked_at,availability_event_at,updated_at
  ) values (
    v_profile,'Ucccccccccccccccccccccccccccccccc','linked_available',true,v_now-interval '1 minute',
    v_now,v_now,v_now
  );

  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000001',gen_random_uuid(),v_profile,'pre_confirmation_reminder','approaching',v_now);
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000002',gen_random_uuid(),v_profile,'wake_reminder','approaching',v_now+interval '1 millisecond');
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000003',gen_random_uuid(),v_profile,'departure_reminder','overdue',v_now+interval '2 milliseconds');
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000004',gen_random_uuid(),v_profile,'arrival_reminder','approaching',v_now+interval '3 milliseconds');
  set constraints all immediate;
  set constraints all deferred;

  perform pg_temp.assert_true(
    (select count(*)=4 from private.line_notification_deliveries where notification_id::text like 'c2020000-0000-4000-8000-%'),
    'all four reminder types enqueue'
  );
  perform pg_temp.assert_true(
    (select count(*)=1 from pg_constraint
     where conrelid='private.line_notification_deliveries'::regclass
       and contype='u' and pg_get_constraintdef(oid)='UNIQUE (notification_id)'),
    'notification has one delivery'
  );
  perform pg_temp.assert_true(
    (select count(distinct retry_key)=4 from private.line_notification_deliveries where notification_id::text like 'c2020000-0000-4000-8000-%'),
    'retry keys are stable and unique'
  );
  perform pg_temp.assert_true(
    (select bool_and(status='pending' and attempt_count=0 and lease_token is null)
     from private.line_notification_deliveries where notification_id::text like 'c2020000-0000-4000-8000-%'),
    'new delivery state is bounded pending'
  );

  select id into v_delivery from private.line_notification_deliveries
  where notification_id='c2020000-0000-4000-8000-000000000001';
  insert into private.line_delivery_attempt_starts(delivery_id,attempt_number,lease_token)
  values(v_delivery,1,gen_random_uuid()) returning id into v_start;
  insert into private.line_delivery_attempt_results(attempt_start_id,outcome,reason,http_status)
  values(v_start,'delivered','provider_accepted',200);
  begin
    update private.line_delivery_attempt_starts set started_at=clock_timestamp() where id=v_start;
    raise exception 'attempt start update unexpectedly allowed';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from private.line_delivery_attempt_results where attempt_start_id=v_start;
    raise exception 'attempt result delete unexpectedly allowed';
  exception when sqlstate '55000' then null;
  end;

  update private.worker_line_links
  set external_reminders_enabled=false,enabled_at=null,updated_at=clock_timestamp()
  where profile_id=v_profile;
  perform pg_temp.assert_true(
    (select count(*)=4 from private.line_notification_deliveries
     where notification_id::text like 'c2020000-0000-4000-8000-%'
       and status='terminal_failure' and status_reason='delivery_disabled'),
    'reminder off terminalizes pending deliveries'
  );

  update private.worker_line_links
  set destination_status='linked_available',external_reminders_enabled=true,
      enabled_at=clock_timestamp()-interval '1 minute',updated_at=clock_timestamp()
  where profile_id=v_profile;
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000005',gen_random_uuid(),v_profile,'wake_reminder','overdue',clock_timestamp());
  update private.worker_line_links
  set destination_status='linked_unavailable',external_reminders_enabled=false,
      enabled_at=null,updated_at=clock_timestamp()
  where profile_id=v_profile;
  perform pg_temp.assert_true(
    (select status='terminal_failure' and status_reason='destination_unavailable'
     from private.line_notification_deliveries where notification_id='c2020000-0000-4000-8000-000000000005'),
    'unfollow state terminalizes pending delivery'
  );

  update private.worker_line_links
  set destination_status='linked_available',external_reminders_enabled=true,
      enabled_at=clock_timestamp()-interval '1 minute',updated_at=clock_timestamp()
  where profile_id=v_profile;
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000006',gen_random_uuid(),v_profile,'arrival_reminder','overdue',clock_timestamp());
  delete from private.worker_line_links where profile_id=v_profile;
  perform pg_temp.assert_true(
    (select status='terminal_failure' and status_reason='destination_unlinked'
     from private.line_notification_deliveries where notification_id='c2020000-0000-4000-8000-000000000006'),
    'unlink terminalizes pending delivery'
  );

  insert into private.worker_line_links(
    profile_id,line_user_id,destination_status,external_reminders_enabled,enabled_at,
    linked_at,availability_event_at,updated_at
  ) values (
    v_profile,'Udddddddddddddddddddddddddddddddd','linked_available',true,clock_timestamp()-interval '1 minute',
    clock_timestamp(),clock_timestamp(),clock_timestamp()
  );
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000007',gen_random_uuid(),v_profile,'departure_reminder','approaching',clock_timestamp());
  update public.workers set status='inactive' where auth_profile_id=v_profile;
  perform pg_temp.assert_true(
    (select status='terminal_failure' and status_reason='worker_inactive'
     from private.line_notification_deliveries where notification_id='c2020000-0000-4000-8000-000000000007'),
    'worker inactive terminalizes pending delivery'
  );

  update public.workers set status='active' where auth_profile_id=v_profile;
  update private.worker_line_links
  set destination_status='linked_available',external_reminders_enabled=false,
      enabled_at=null,updated_at=clock_timestamp()
  where profile_id=v_profile;
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000008',gen_random_uuid(),v_profile,'wake_reminder','approaching',clock_timestamp());
  perform pg_temp.assert_true(
    not exists(select 1 from private.line_notification_deliveries where notification_id='c2020000-0000-4000-8000-000000000008'),
    'disabled consent does not enqueue'
  );

  update private.worker_line_links
  set destination_status='linked_available',external_reminders_enabled=true,
      enabled_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp()
  where profile_id=v_profile;
  perform pg_temp.insert_reminder('c2020000-0000-4000-8000-000000000009',gen_random_uuid(),v_profile,'wake_reminder','overdue',clock_timestamp());
  perform pg_temp.assert_true(
    not exists(select 1 from private.line_notification_deliveries where notification_id='c2020000-0000-4000-8000-000000000009'),
    'notification before consent watermark does not enqueue'
  );

  perform pg_temp.assert_true(
    not exists(
      select 1 from information_schema.columns
      where table_schema='private'
        and table_name in ('line_notification_deliveries','line_delivery_attempt_starts','line_delivery_attempt_results')
        and column_name in ('line_user_id','access_token','refresh_token','id_token','title','summary','message_body')
    ),
    'delivery persistence contains no destination token or message body'
  );
  perform pg_temp.assert_true(
    (select count(*)=3 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='private'
       and c.relname in ('line_notification_deliveries','line_delivery_attempt_starts','line_delivery_attempt_results')
       and c.relrowsecurity),
    'all delivery tables have RLS'
  );
  perform pg_temp.assert_true(
    not has_table_privilege('anon','private.line_notification_deliveries','SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated','private.line_notification_deliveries','SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('service_role','private.line_notification_deliveries','SELECT,INSERT,UPDATE,DELETE'),
    'delivery table has no runtime DML grants'
  );
  perform pg_temp.assert_true(
    (select read_at is null from public.in_app_notifications where id='c2020000-0000-4000-8000-000000000001'),
    'enqueue and terminalization do not mark Notification read'
  );
end;
$body$;

select unnest(array[
  'four reminder types enqueue','one delivery per Notification','stable unique retry key',
  'pending state shape','attempt starts append-only','attempt results append-only',
  'Reminder OFF terminalization','unfollow terminalization','unlink terminalization',
  'inactive Worker terminalization','disabled consent skip','enablement watermark skip',
  'no destination/token/body persistence','RLS enabled','runtime DML denied',
  'Notification read state unchanged'
]);
rollback;
`;

const output = execFileSync("docker", [
  "exec", "-i", "supabase_db_dispatch-os", "psql", "-U", "postgres", "-d", "postgres",
  "-v", "ON_ERROR_STOP=1", "-Atq",
], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

const checks = output.trim().split(/\r?\n/).filter(Boolean);
assert.equal(checks.length, 16);
for (const check of checks) console.log(`PASS ${check}`);
console.log(`Worker LINE delivery enqueue: PASS (${checks.length} assertions)`);
