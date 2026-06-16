-- 042_backfill_creator_billing.sql
-- Concierge/legacy creators created without a creator_billing row read as
-- "locked" (isBillingLocked treats a missing row as locked), which hides the
-- Subscribe option on their public page ("This creator is currently
-- unavailable"). Give every creator that has no billing row a 1-year trial.
insert into public.creator_billing (user_id, status, tier, trial_ends_at, current_period_end)
select distinct cp.user_id, 'trial', 'starter',
       now() + interval '365 days', now() + interval '365 days'
from public.creator_profiles cp
where cp.user_id is not null
  and not exists (
    select 1 from public.creator_billing cb where cb.user_id = cp.user_id
  )
on conflict (user_id) do nothing;
