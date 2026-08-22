-- Pre-shift confirmations are immutable worker-submitted answers.
-- Existing SELECT policies and the worker-owned INSERT policy remain unchanged.

drop policy "Workers can update own pre shift confirmations"
on public.pre_shift_confirmations;

drop policy "Managers can update branch pre shift confirmations"
on public.pre_shift_confirmations;

drop policy "System admins can create pre shift confirmations"
on public.pre_shift_confirmations;

drop policy "System admins can update pre shift confirmations"
on public.pre_shift_confirmations;
