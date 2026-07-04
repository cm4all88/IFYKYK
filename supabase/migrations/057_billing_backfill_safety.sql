-- ──────────────────────────────────────────────────────────────────
-- 057_billing_backfill_safety.sql
-- Safety net for the "This creator is currently unavailable" problem.
--
-- A creator is locked (their public page can't take subscriptions) when they
-- have no creator_billing row. Migration 045 was supposed to guarantee every
-- creator has a free row and that new creators auto-provision one. If 045 did
-- not run, creators show as unavailable. This migration re-applies the 045
-- essentials idempotently, so it is safe to run whether or not 045 ever did.
--
-- Run this once in Supabase. It does not touch paying creators.
-- ──────────────────────────────────────────────────────────────────

-- 1. Allow 'free' as a billing status (no-op if already allowed).
alter table public.creator_billing
  drop constraint if exists creator_billing_status_check;
alter table public.creator_billing
  add constraint creator_billing_status_check
  check (status in ('free', 'trial', 'active', 'past_due', 'cancelled', 'incomplete'));

-- 2. New rows default to free.
alter table public.creator_billing
  alter column status set default 'free';

-- 3. Convert never-paying trials to free. Anyone on a trial who never started a
--    paid Stripe subscription belongs on the free Opening Act plan, so they are
--    never locked when the trial clock runs out. Real payers (those with a
--    stripe_subscription_id) are left completely untouched.
update public.creator_billing
   set status = 'free',
       trial_ends_at = null
 where status = 'trial'
   and stripe_subscription_id is null;

-- 4. Give every creator a billing row (defaulting to free) so none is locked
--    just because a row is missing. Real payers already have a row, so they
--    are skipped. Nothing here changes an existing row.
insert into public.creator_billing (user_id, status, tier)
select distinct cp.user_id, 'free', 'starter'
  from public.creator_profiles cp
 where cp.user_id is not null
   and not exists (
     select 1 from public.creator_billing cb where cb.user_id = cp.user_id
   )
on conflict (user_id) do nothing;

-- 5. Auto-provision a free row whenever a creator profile is created, so new
--    signups are never dark on day one, regardless of which path made them.
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
