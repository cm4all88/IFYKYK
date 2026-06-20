-- ──────────────────────────────────────────────────────────────────
-- 045_free_billing_status.sql
-- Opening Act: a real free plan. Every creator starts free (no card,
-- never locked) and only enters the paid ladder when they convert.
--   1. add 'free' to the status enum
--   2. make 'free' the default for new rows
--   3. convert non-paying trials (the 042 cohort) to free
--   4. give every existing creator a row, so none is locked for lack of one
--   5. auto-provision a free row whenever a creator profile is created
-- ──────────────────────────────────────────────────────────────────

-- 1. Allow 'free' as a billing status.
alter table public.creator_billing
  drop constraint if exists creator_billing_status_check;
alter table public.creator_billing
  add constraint creator_billing_status_check
  check (status in ('free', 'trial', 'active', 'past_due', 'cancelled', 'incomplete'));

-- 2. New rows default to free.
alter table public.creator_billing
  alter column status set default 'free';

-- 3. Convert legacy / never-subscribed trials to free. Anyone who never
--    started a paid Stripe subscription belongs on Opening Act. Real
--    payers (those with a stripe_subscription_id) are left untouched.
update public.creator_billing
   set status = 'free',
       trial_ends_at = null
 where status = 'trial'
   and stripe_subscription_id is null;

-- 4. Ensure every creator has a billing row, defaulting to free, so no
--    creator is ever locked merely because a row is missing. The public
--    page and the publish route both treat a missing row as locked.
insert into public.creator_billing (user_id, status, tier)
select distinct cp.user_id, 'free', 'starter'
  from public.creator_profiles cp
 where cp.user_id is not null
   and not exists (
     select 1 from public.creator_billing cb where cb.user_id = cp.user_id
   )
on conflict (user_id) do nothing;

-- 5. Auto-provision a free billing row on creator-profile creation,
--    regardless of which app path created the profile. Bulletproofs new
--    signups so a creator's public page is never dark on day one.
create or replace function public.provision_free_billing()
returns trigger language plpgsql security definer as $$
begin
  if new.user_id is not null then
    insert into public.creator_billing (user_id, status, tier)
    values (new.user_id, 'free', 'starter')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_provision_free_billing on public.creator_profiles;
create trigger trg_provision_free_billing
  after insert on public.creator_profiles
  for each row execute function public.provision_free_billing();
