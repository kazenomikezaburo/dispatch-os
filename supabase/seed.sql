-- LOCAL/TEST ONLY. Never run this seed against a production Supabase project.
-- All identities and business records below are fictional and use fixed UUIDs.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'worker-a@test.invalid', '$2a$10$TESTONLYNOTAVALIDLOGINHASH000000000000000000000000000', now(), '{"provider":"email","providers":["email"]}', '{"test_actor":"worker_a"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'worker-b@test.invalid', '$2a$10$TESTONLYNOTAVALIDLOGINHASH000000000000000000000000000', now(), '{"provider":"email","providers":["email"]}', '{"test_actor":"worker_b"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'worker-c@test.invalid', '$2a$10$TESTONLYNOTAVALIDLOGINHASH000000000000000000000000000', now(), '{"provider":"email","providers":["email"]}', '{"test_actor":"worker_c"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'manager-a@test.invalid', '$2a$10$TESTONLYNOTAVALIDLOGINHASH000000000000000000000000000', now(), '{"provider":"email","providers":["email"]}', '{"test_actor":"manager_a"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'system-admin@test.invalid', '$2a$10$TESTONLYNOTAVALIDLOGINHASH000000000000000000000000000', now(), '{"provider":"email","providers":["email"]}', '{"test_actor":"system_admin"}', now(), now())
on conflict (id) do update set
  email = excluded.email,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.branches (id, code, name)
values
  ('b0000000-0000-0000-0000-000000000001', 'NAGOYA_TEST', 'TEST 名古屋支店'),
  ('b0000000-0000-0000-0000-000000000002', 'TOKYO_TEST', 'TEST 東京支店')
on conflict (id) do update set code = excluded.code, name = excluded.name;

insert into public.profiles (id, display_name, account_type)
values
  ('a0000000-0000-0000-0000-000000000001', 'TEST Worker A', 'worker'),
  ('a0000000-0000-0000-0000-000000000002', 'TEST Worker B', 'worker'),
  ('a0000000-0000-0000-0000-000000000003', 'TEST Worker C', 'worker'),
  ('a0000000-0000-0000-0000-000000000004', 'TEST Manager A', 'manager'),
  ('a0000000-0000-0000-0000-000000000005', 'TEST System Admin', 'system_admin')
on conflict (id) do update set
  display_name = excluded.display_name,
  account_type = excluded.account_type,
  is_active = true;

insert into public.manager_branch_access (profile_id, branch_id, role)
values ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'manager')
on conflict (profile_id, branch_id) do update set role = excluded.role;

insert into public.workers (id, staff_code, branch_id, auth_profile_id, display_name, status)
values
  ('c0000000-0000-0000-0000-000000000001', 'TEST_WORKER_A', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'TEST Worker A', 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'TEST_WORKER_B', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'TEST Worker B', 'active'),
  ('c0000000-0000-0000-0000-000000000003', 'TEST_WORKER_C', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'TEST Worker C', 'active')
on conflict (id) do update set
  staff_code = excluded.staff_code,
  branch_id = excluded.branch_id,
  auth_profile_id = excluded.auth_profile_id,
  display_name = excluded.display_name,
  status = excluded.status;

insert into public.clients (id, branch_id, name)
values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'TEST Nagoya Client'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'TEST Tokyo Client')
on conflict (id) do update set branch_id = excluded.branch_id, name = excluded.name;

insert into public.workplaces (id, branch_id, name, address)
values
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'TEST Nagoya Workplace', 'TEST Nagoya Address'),
  ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'TEST Tokyo Workplace', 'TEST Tokyo Address')
on conflict (id) do update set branch_id = excluded.branch_id, name = excluded.name, address = excluded.address;

insert into public.projects (
  id, branch_id, client_id, name, project_type, status,
  start_date, end_date, created_by
)
values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'TEST Project N1', 'normal', 'recruiting', '2099-01-01', '2099-01-31', 'a0000000-0000-0000-0000-000000000004'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'TEST Project N2', 'normal', 'closed', '2099-02-01', '2099-02-28', 'a0000000-0000-0000-0000-000000000004'),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'TEST Project T1', 'normal', 'recruiting', '2099-03-01', '2099-03-31', 'a0000000-0000-0000-0000-000000000005'),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'TEST Past Project', 'normal', 'completed', '2000-01-01', '2000-01-02', 'a0000000-0000-0000-0000-000000000004')
on conflict (id) do update set
  branch_id = excluded.branch_id,
  client_id = excluded.client_id,
  name = excluded.name,
  status = excluded.status,
  start_date = excluded.start_date,
  end_date = excluded.end_date;

insert into public.jobs (id, project_id, workplace_id, name, status)
values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'TEST Job N1', 'recruiting'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'TEST Job N2', 'closed'),
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 'TEST Job T1', 'recruiting'),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 'TEST Past Job', 'completed')
on conflict (id) do update set project_id = excluded.project_id, workplace_id = excluded.workplace_id, name = excluded.name, status = excluded.status;

insert into public.shift_slots (
  id, job_id, label, starts_at, ends_at, required_workers, status
)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'TEST Shift N1', '2099-01-15 09:00:00+09', '2099-01-15 18:00:00+09', 3, 'recruiting'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'TEST Shift N2', '2099-02-15 09:00:00+09', '2099-02-15 18:00:00+09', 2, 'closed'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'TEST Shift T1', '2099-03-15 09:00:00+09', '2099-03-15 18:00:00+09', 2, 'recruiting'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'TEST Past Shift', '2000-01-01 09:00:00+09', '2000-01-01 18:00:00+09', 1, 'completed'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'TEST Shift N1B', '2099-01-16 09:00:00+09', '2099-01-16 18:00:00+09', 1, 'recruiting')
on conflict (id) do update set job_id = excluded.job_id, label = excluded.label, starts_at = excluded.starts_at, ends_at = excluded.ends_at, required_workers = excluded.required_workers, status = excluded.status;

insert into public.shift_applications (id, shift_slot_id, worker_id, status)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'accepted'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'applied')
on conflict (id) do update set shift_slot_id = excluded.shift_slot_id, worker_id = excluded.worker_id, status = excluded.status;

insert into public.assignments (id, shift_slot_id, worker_id, source, status, assigned_by)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'manager', 'confirmed', 'a0000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'manager', 'confirmed', 'a0000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'manager', 'confirmed', 'a0000000-0000-0000-0000-000000000005'),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'manager', 'completed', 'a0000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'manager', 'confirmed', 'a0000000-0000-0000-0000-000000000004')
on conflict (id) do update set shift_slot_id = excluded.shift_slot_id, worker_id = excluded.worker_id, source = excluded.source, status = excluded.status, assigned_by = excluded.assigned_by;

insert into public.pre_shift_confirmations (id, assignment_id, can_work, health_status, comment)
values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', true, 'good', 'TEST Worker B confirmation'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', true, 'good', 'TEST Worker C confirmation'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', true, 'good', 'TEST Worker A future confirmation'),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', true, 'good', 'TEST Worker A past confirmation')
on conflict (id) do update set assignment_id = excluded.assignment_id, can_work = excluded.can_work, health_status = excluded.health_status, comment = excluded.comment;

insert into public.attendance_events (id, assignment_id, event_type, source, location_status, idempotency_key)
values
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'arrive', 'worker', 'not_requested', '61000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'arrive', 'worker', 'not_requested', '61000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'arrive', 'worker', 'not_requested', '61000000-0000-0000-0000-000000000003')
on conflict (id) do update set assignment_id = excluded.assignment_id, event_type = excluded.event_type, source = excluded.source, location_status = excluded.location_status;

insert into public.attendance_records (
  id, assignment_id, planned_start_at, planned_end_at, status
)
values
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2099-02-15 09:00:00+09', '2099-02-15 18:00:00+09', 'scheduled'),
  ('70000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '2099-01-15 09:00:00+09', '2099-01-15 18:00:00+09', 'scheduled'),
  ('70000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '2099-03-15 09:00:00+09', '2099-03-15 18:00:00+09', 'scheduled')
on conflict (id) do update set assignment_id = excluded.assignment_id, planned_start_at = excluded.planned_start_at, planned_end_at = excluded.planned_end_at, status = excluded.status;
