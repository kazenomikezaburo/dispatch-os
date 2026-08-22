select
  a.id as assignment_id,
  a.status,
  a.shift_slot_id,
  w.id as worker_id,
  p.display_name as worker_name
from public.assignments a
join public.workers w
  on w.id = a.worker_id
join public.profiles p
  on p.id = w.auth_profile_id
order by a.created_at desc;