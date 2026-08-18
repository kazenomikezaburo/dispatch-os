-- 派遣業務OS Database Design v1.0
-- Initial schema: 14 public tables, indexes, updated_at triggers, and RLS.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text,
  emergency_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_code_not_blank check (btrim(code) <> ''),
  constraint branches_name_not_blank check (btrim(name) <> '')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  account_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank
    check (btrim(display_name) <> ''),
  constraint profiles_account_type_check
    check (account_type in ('worker', 'manager', 'system_admin'))
);

create table public.manager_branch_access (
  profile_id uuid not null,
  branch_id uuid not null,
  role text not null default 'manager',
  created_at timestamptz not null default now(),
  constraint manager_branch_access_pkey
    primary key (profile_id, branch_id),
  constraint manager_branch_access_profile_id_fkey
    foreign key (profile_id)
    references public.profiles(id)
    on delete cascade,
  constraint manager_branch_access_branch_id_fkey
    foreign key (branch_id)
    references public.branches(id)
    on delete restrict,
  constraint manager_branch_access_role_check
    check (role in ('manager', 'branch_manager'))
);

create index idx_manager_branch_access_branch
  on public.manager_branch_access(branch_id);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  staff_code text not null unique,
  branch_id uuid not null,
  auth_profile_id uuid unique,
  display_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workers_branch_id_fkey
    foreign key (branch_id)
    references public.branches(id)
    on delete restrict,
  constraint workers_auth_profile_id_fkey
    foreign key (auth_profile_id)
    references public.profiles(id)
    on delete set null,
  constraint workers_staff_code_not_blank
    check (btrim(staff_code) <> ''),
  constraint workers_display_name_not_blank
    check (btrim(display_name) <> ''),
  constraint workers_status_check
    check (status in ('active', 'inactive', 'suspended'))
);

create index idx_workers_branch_status
  on public.workers(branch_id, status);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  name text not null,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_branch_id_fkey
    foreign key (branch_id)
    references public.branches(id)
    on delete restrict,
  constraint clients_name_not_blank check (btrim(name) <> '')
);

create index idx_clients_branch
  on public.clients(branch_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  client_id uuid,
  name text not null,
  project_type text not null default 'normal',
  status text not null default 'draft',
  recruitment_start_at timestamptz,
  recruitment_end_at timestamptz,
  start_date date not null,
  end_date date not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_branch_id_fkey
    foreign key (branch_id)
    references public.branches(id)
    on delete restrict,
  constraint projects_client_id_fkey
    foreign key (client_id)
    references public.clients(id)
    on delete set null,
  constraint projects_created_by_fkey
    foreign key (created_by)
    references public.profiles(id)
    on delete set null,
  constraint projects_project_type_check
    check (project_type in ('normal', 'large_event')),
  constraint projects_status_check
    check (
      status in (
        'draft',
        'recruiting',
        'closed',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),
  constraint projects_dates_check check (end_date >= start_date),
  constraint projects_recruitment_period_check
    check (
      recruitment_end_at is null
      or recruitment_start_at is null
      or recruitment_end_at >= recruitment_start_at
    )
);

create index idx_projects_branch_status
  on public.projects(branch_id, status);

create index idx_projects_branch_dates
  on public.projects(branch_id, start_date, end_date);

create table public.workplaces (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  name text not null,
  postal_code text,
  address text not null,
  latitude double precision,
  longitude double precision,
  map_url text,
  default_transport_note text,
  access_note text,
  meeting_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workplaces_branch_id_fkey
    foreign key (branch_id)
    references public.branches(id)
    on delete restrict,
  constraint workplaces_name_not_blank check (btrim(name) <> ''),
  constraint workplaces_address_not_blank check (btrim(address) <> ''),
  constraint workplaces_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint workplaces_longitude_check
    check (longitude is null or longitude between -180 and 180)
);

create index idx_workplaces_branch_active
  on public.workplaces(branch_id, is_active);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  workplace_id uuid not null,
  name text not null,
  work_type text,
  description text,
  clothing_note text,
  belongings_note text,
  access_note text,
  meeting_note text,
  lodging_note text,
  transport_type text not null default 'none',
  transport_amount integer,
  transport_max_amount integer,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_project_id_fkey
    foreign key (project_id)
    references public.projects(id)
    on delete restrict,
  constraint jobs_workplace_id_fkey
    foreign key (workplace_id)
    references public.workplaces(id)
    on delete restrict,
  constraint jobs_transport_type_check
    check (transport_type in ('none', 'fixed', 'maximum', 'actual')),
  constraint jobs_transport_amount_check
    check (transport_amount is null or transport_amount >= 0),
  constraint jobs_transport_max_amount_check
    check (transport_max_amount is null or transport_max_amount >= 0),
  constraint jobs_status_check
    check (
      status in (
        'draft',
        'recruiting',
        'closed',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled'
      )
    )
);

create index idx_jobs_project_status
  on public.jobs(project_id, status);

create index idx_jobs_workplace
  on public.jobs(workplace_id);

create table public.shift_slots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_at timestamptz,
  required_workers smallint not null default 1,
  planned_break_minutes smallint,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_slots_job_id_fkey
    foreign key (job_id)
    references public.jobs(id)
    on delete restrict,
  constraint shift_slots_time_range_check check (ends_at > starts_at),
  constraint shift_slots_meeting_at_check
    check (meeting_at is null or meeting_at <= starts_at),
  constraint shift_slots_required_workers_check check (required_workers > 0),
  constraint shift_slots_planned_break_minutes_check
    check (
      planned_break_minutes is null
      or planned_break_minutes >= 0
    ),
  constraint shift_slots_status_check
    check (
      status in (
        'draft',
        'recruiting',
        'closed',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled'
      )
    )
);

create index idx_shift_slots_job_start
  on public.shift_slots(job_id, starts_at);

create index idx_shift_slots_status_start
  on public.shift_slots(status, starts_at);

create table public.shift_applications (
  id uuid primary key default gen_random_uuid(),
  shift_slot_id uuid not null,
  worker_id uuid not null,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_applications_shift_slot_id_fkey
    foreign key (shift_slot_id)
    references public.shift_slots(id)
    on delete restrict,
  constraint shift_applications_worker_id_fkey
    foreign key (worker_id)
    references public.workers(id)
    on delete restrict,
  constraint shift_applications_reviewed_by_fkey
    foreign key (reviewed_by)
    references public.profiles(id)
    on delete set null,
  constraint shift_applications_slot_worker_key
    unique (shift_slot_id, worker_id),
  constraint shift_applications_status_check
    check (status in ('applied', 'accepted', 'rejected', 'withdrawn'))
);

create index idx_shift_applications_worker_status
  on public.shift_applications(worker_id, status);

create index idx_shift_applications_slot_status
  on public.shift_applications(shift_slot_id, status);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  shift_slot_id uuid not null,
  worker_id uuid not null,
  source text not null default 'manager',
  status text not null default 'assigned',
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_shift_slot_id_fkey
    foreign key (shift_slot_id)
    references public.shift_slots(id)
    on delete restrict,
  constraint assignments_worker_id_fkey
    foreign key (worker_id)
    references public.workers(id)
    on delete restrict,
  constraint assignments_assigned_by_fkey
    foreign key (assigned_by)
    references public.profiles(id)
    on delete set null,
  constraint assignments_slot_worker_key unique (shift_slot_id, worker_id),
  constraint assignments_source_check
    check (source in ('application', 'manager', 'import')),
  constraint assignments_status_check
    check (
      status in (
        'assigned',
        'confirmed',
        'cancelled_by_worker',
        'cancelled_by_company',
        'absent',
        'no_show',
        'completed'
      )
    )
);

create index idx_assignments_worker_status
  on public.assignments(worker_id, status);

create index idx_assignments_slot_status
  on public.assignments(shift_slot_id, status);

create table public.pre_shift_confirmations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique,
  can_work boolean not null,
  health_status text not null,
  planned_wake_at timestamptz,
  planned_departure_at timestamptz,
  comment text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pre_shift_confirmations_assignment_id_fkey
    foreign key (assignment_id)
    references public.assignments(id)
    on delete restrict,
  constraint pre_shift_confirmations_health_status_check
    check (health_status in ('good', 'concern', 'unwell')),
  constraint pre_shift_confirmations_planned_times_check
    check (
      planned_departure_at is null
      or planned_wake_at is null
      or planned_departure_at >= planned_wake_at
    )
);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  event_type text not null,
  client_occurred_at timestamptz,
  server_received_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  location_status text not null default 'not_requested',
  source text not null default 'worker',
  idempotency_key uuid unique,
  constraint attendance_events_assignment_id_fkey
    foreign key (assignment_id)
    references public.assignments(id)
    on delete restrict,
  constraint attendance_events_event_type_check
    check (
      event_type in (
        'wake_up',
        'depart',
        'arrive',
        'start_work',
        'break_start',
        'break_end',
        'end_work',
        'submit'
      )
    ),
  constraint attendance_events_location_status_check
    check (
      location_status in (
        'captured',
        'denied',
        'unavailable',
        'not_requested'
      )
    ),
  constraint attendance_events_source_check
    check (source in ('worker', 'manager', 'system')),
  constraint attendance_events_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint attendance_events_longitude_check
    check (longitude is null or longitude between -180 and 180),
  constraint attendance_events_accuracy_m_check
    check (accuracy_m is null or accuracy_m >= 0)
);

create index idx_attendance_events_assignment_time
  on public.attendance_events(assignment_id, server_received_at desc);

create index idx_attendance_events_assignment_type
  on public.attendance_events(assignment_id, event_type);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique,
  planned_start_at timestamptz not null,
  planned_end_at timestamptz not null,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  total_break_minutes smallint,
  worker_note text,
  status text not null default 'scheduled',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_assignment_id_fkey
    foreign key (assignment_id)
    references public.assignments(id)
    on delete restrict,
  constraint attendance_records_approved_by_fkey
    foreign key (approved_by)
    references public.profiles(id)
    on delete set null,
  constraint attendance_records_planned_times_check
    check (planned_end_at > planned_start_at),
  constraint attendance_records_actual_times_check
    check (
      actual_end_at is null
      or actual_start_at is null
      or actual_end_at >= actual_start_at
    ),
  constraint attendance_records_total_break_minutes_check
    check (total_break_minutes is null or total_break_minutes >= 0),
  constraint attendance_records_status_check
    check (
      status in (
        'scheduled',
        'working',
        'finished',
        'submitted',
        'approved',
        'needs_correction'
      )
    )
);

create index idx_attendance_records_status
  on public.attendance_records(status);

create trigger set_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_workers_updated_at
before update on public.workers
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_workplaces_updated_at
before update on public.workplaces
for each row execute function public.set_updated_at();

create trigger set_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger set_shift_slots_updated_at
before update on public.shift_slots
for each row execute function public.set_updated_at();

create trigger set_shift_applications_updated_at
before update on public.shift_applications
for each row execute function public.set_updated_at();

create trigger set_assignments_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

create trigger set_pre_shift_confirmations_updated_at
before update on public.pre_shift_confirmations
for each row execute function public.set_updated_at();

create trigger set_attendance_records_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.manager_branch_access enable row level security;
alter table public.workers enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.workplaces enable row level security;
alter table public.jobs enable row level security;
alter table public.shift_slots enable row level security;
alter table public.shift_applications enable row level security;
alter table public.assignments enable row level security;
alter table public.pre_shift_confirmations enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_records enable row level security;
