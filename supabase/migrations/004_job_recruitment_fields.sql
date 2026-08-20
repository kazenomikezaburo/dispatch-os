alter table public.jobs
  add column hourly_wage integer,
  add column transportation_fee_cap integer,
  add column dress_code text,
  add column requirements text,
  add column meal_notes text,
  add column recruitment_notes text,
  add column manual_url text,
  add constraint jobs_hourly_wage_nonnegative_check
    check (hourly_wage is null or hourly_wage >= 0),
  add constraint jobs_transportation_fee_cap_nonnegative_check
    check (
      transportation_fee_cap is null
      or transportation_fee_cap >= 0
    );

alter table public.shift_slots
  add column break_minutes integer,
  add column application_deadline timestamptz,
  add constraint shift_slots_break_minutes_nonnegative_check
    check (break_minutes is null or break_minutes >= 0),
  add constraint shift_slots_application_deadline_check
    check (
      application_deadline is null
      or application_deadline <= starts_at
    );
