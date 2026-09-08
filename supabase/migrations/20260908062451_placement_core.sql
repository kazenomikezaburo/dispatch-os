-- DB-2.5C1: Placement Core.
-- Planned break, coverage, commands, revisions and lifecycle validation are deferred to DB-2.5C2.

create extension if not exists btree_gist with schema extensions;

create table public.shift_placement_plans (
  id uuid primary key default gen_random_uuid(),
  shift_slot_id uuid not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_placement_plans_shift_slot_id_fkey
    foreign key (shift_slot_id)
    references public.shift_slots(id)
    on delete restrict,
  constraint shift_placement_plans_shift_slot_id_key
    unique (shift_slot_id),
  constraint shift_placement_plans_id_shift_slot_id_key
    unique (id, shift_slot_id),
  constraint shift_placement_plans_version_positive_check
    check (version >= 1)
);

-- The composite target is required to prove a segment's existing Assignment
-- belongs to the same Shift as its Placement Plan. It does not alter Assignment data or lifecycle.
alter table public.assignments
  add constraint assignments_id_shift_slot_id_key
  unique (id, shift_slot_id);

create table public.shift_positions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  label text not null,
  required_workers smallint,
  display_order integer not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_positions_plan_id_fkey
    foreign key (plan_id)
    references public.shift_placement_plans(id)
    on delete restrict,
  constraint shift_positions_id_plan_id_key
    unique (id, plan_id),
  constraint shift_positions_plan_id_display_order_key
    unique (plan_id, display_order),
  constraint shift_positions_label_not_blank
    check (btrim(label) <> ''),
  constraint shift_positions_required_workers_nonnegative_check
    check (required_workers is null or required_workers >= 0),
  constraint shift_positions_display_order_nonnegative_check
    check (display_order >= 0)
);

create table public.assignment_placement_segments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  shift_slot_id uuid not null,
  assignment_id uuid not null,
  position_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_placement_segments_plan_shift_fkey
    foreign key (plan_id, shift_slot_id)
    references public.shift_placement_plans(id, shift_slot_id)
    on delete restrict,
  constraint assignment_placement_segments_assignment_shift_fkey
    foreign key (assignment_id, shift_slot_id)
    references public.assignments(id, shift_slot_id)
    on delete restrict,
  constraint assignment_placement_segments_position_plan_fkey
    foreign key (position_id, plan_id)
    references public.shift_positions(id, plan_id)
    on delete restrict,
  constraint assignment_placement_segments_time_range_check
    check (end_at > start_at),
  constraint assignment_placement_segments_assignment_time_excl
    exclude using gist (
      assignment_id with =,
      tstzrange(start_at, end_at, '[)') with &&
    )
);

create index idx_shift_positions_plan_display_order
  on public.shift_positions(plan_id, display_order);

create index idx_assignment_placement_segments_plan_start
  on public.assignment_placement_segments(plan_id, start_at);

create index idx_assignment_placement_segments_position_start
  on public.assignment_placement_segments(position_id, start_at);

create trigger set_shift_placement_plans_updated_at
before update on public.shift_placement_plans
for each row execute function public.set_updated_at();

create trigger set_shift_positions_updated_at
before update on public.shift_positions
for each row execute function public.set_updated_at();

create trigger set_assignment_placement_segments_updated_at
before update on public.assignment_placement_segments
for each row execute function public.set_updated_at();

alter table public.shift_placement_plans enable row level security;
alter table public.shift_positions enable row level security;
alter table public.assignment_placement_segments enable row level security;

create policy "Managers can view branch shift placement plans"
on public.shift_placement_plans for select to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id));

create policy "System admins can view all shift placement plans"
on public.shift_placement_plans for select to authenticated
using (private.is_system_admin());

create policy "Managers can view branch shift positions"
on public.shift_positions for select to authenticated
using (
  exists (
    select 1
    from public.shift_placement_plans as spp
    where spp.id = shift_positions.plan_id
      and private.has_shift_slot_branch_access(spp.shift_slot_id)
  )
);

create policy "System admins can view all shift positions"
on public.shift_positions for select to authenticated
using (private.is_system_admin());

create policy "Managers can view branch assignment placement segments"
on public.assignment_placement_segments for select to authenticated
using (private.has_shift_slot_branch_access(shift_slot_id));

create policy "System admins can view all assignment placement segments"
on public.assignment_placement_segments for select to authenticated
using (private.is_system_admin());

revoke all privileges on table public.shift_placement_plans from anon;
revoke all privileges on table public.shift_placement_plans from authenticated;
grant select on table public.shift_placement_plans to authenticated;

revoke all privileges on table public.shift_positions from anon;
revoke all privileges on table public.shift_positions from authenticated;
grant select on table public.shift_positions to authenticated;

revoke all privileges on table public.assignment_placement_segments from anon;
revoke all privileges on table public.assignment_placement_segments from authenticated;
grant select on table public.assignment_placement_segments to authenticated;
